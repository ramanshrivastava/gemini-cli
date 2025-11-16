/**
 * Mini Gemini CLI - Entry Point
 *
 * Phase 1: Chat with tools
 * - Read API key from environment
 * - Create GeminiClient with tool support
 * - REPL with function calling
 *
 * Usage:
 *   GEMINI_API_KEY=your_key npm start
 */

import { GeminiClient } from './client.js';
import { ToolRegistry } from './tools/registry.js';
import { ReadFileTool } from './tools/read-file.js';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

async function main() {
  // Get API key from environment
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY environment variable not set');
    console.error('Usage: GEMINI_API_KEY=your_key npm start');
    process.exit(1);
  }

  // Create client
  const client = new GeminiClient({ apiKey });

  // Set up tool registry
  const registry = new ToolRegistry();
  registry.register(new ReadFileTool());

  console.log('Mini Gemini CLI - Phase 1: Chat with Tools');
  console.log(`Available tools: ${registry.listAll().map(t => t.schema.name).join(', ')}`);
  console.log('Type your message and press Enter');
  console.log('Type "exit" to quit\n');

  // Create readline interface
  const rl = readline.createInterface({ input, output });

  // REPL with tool support
  while (true) {
    const userInput = await rl.question('You: ');

    if (userInput.toLowerCase() === 'exit') {
      console.log('Goodbye!');
      rl.close();
      break;
    }

    if (!userInput.trim()) {
      continue;
    }

    try {
      // Send message with tools
      const tools = registry.getFunctionDeclarations();
      const response = await client.sendMessage(userInput, tools);

      // Handle text response
      if (response.text) {
        console.log(`\nAssistant: ${response.text}\n`);
      }

      // Handle function calls
      if (response.functionCalls && response.functionCalls.length > 0) {
        console.log(`\n[Tool execution]`);

        const functionResponses = [];

        for (const fnCall of response.functionCalls) {
          console.log(`  Calling ${fnCall.name}...`);

          // Get tool from registry
          const tool = registry.get(fnCall.name);

          // Validate parameters
          const validationError = tool.validate(fnCall.args ?? {});
          if (validationError) {
            console.error(`  ❌ Validation error: ${validationError}`);
            functionResponses.push({
              name: fnCall.name,
              response: { error: validationError },
            });
            continue;
          }

          // Execute tool
          const result = await tool.execute(fnCall.args ?? {});

          if (result.success) {
            console.log(`  ✓ Success`);
            functionResponses.push({
              name: fnCall.name,
              response: { output: result.output },
            });
          } else {
            console.error(`  ❌ Error: ${result.error}`);
            functionResponses.push({
              name: fnCall.name,
              response: { error: result.error },
            });
          }
        }

        // Send function results back to model
        const finalResponse = await client.sendFunctionResults(
          functionResponses,
          tools
        );

        if (finalResponse.text) {
          console.log(`\nAssistant: ${finalResponse.text}\n`);
        }
      }
    } catch (error) {
      console.error(
        `\nError: ${error instanceof Error ? error.message : String(error)}\n`
      );
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
