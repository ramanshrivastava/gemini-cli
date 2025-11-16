/**
 * Mini Gemini CLI - Entry Point
 *
 * Phase 2: Agentic orchestration
 * - Read API key from environment
 * - Create GeminiClient with tool support
 * - AgentExecutor with while(true) loop
 * - Multi-turn task completion
 *
 * Usage:
 *   GEMINI_API_KEY=your_key npm start
 */

import { GeminiClient } from './client.js';
import { AgentExecutor } from './agent/executor.js';
import type { AgentConfig } from './agent/types.js';
import { ReadFileTool } from './tools/read-file.js';
import { WriteFileTool } from './tools/write-file.js';
import { CompleteTaskTool } from './tools/complete-task.js';
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

  // Set up agent config with tools
  const agentConfig: AgentConfig = {
    maxTurns: 20,
    maxTimeMinutes: 5,
    tools: [
      new ReadFileTool(),
      new WriteFileTool(),
      new CompleteTaskTool(),
    ],
  };

  // Create agent executor
  const executor = new AgentExecutor(client, agentConfig);

  console.log('Mini Gemini CLI - Phase 2: Agentic Orchestration');
  console.log(`Available tools: ${agentConfig.tools.map(t => t.schema.name).join(', ')}`);
  console.log('Type your task and press Enter');
  console.log('The agent will work autonomously until completion\n');
  console.log('Type "exit" to quit\n');

  // Create readline interface
  const rl = readline.createInterface({ input, output });

  // REPL with agent executor
  while (true) {
    const userInput = await rl.question('Task: ');

    if (userInput.toLowerCase() === 'exit') {
      console.log('Goodbye!');
      rl.close();
      break;
    }

    if (!userInput.trim()) {
      continue;
    }

    try {
      console.log('\n=== Agent Starting ===\n');

      // Run agent
      const result = await executor.run(userInput);

      // Display results
      console.log('\n=== Agent Finished ===');
      console.log(`Result: ${result.result}`);
      console.log(`Reason: ${result.terminateReason}`);
      console.log(`Turns: ${result.turnCount}`);
      console.log(`Time: ${(result.timeMs / 1000).toFixed(2)}s\n`);
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
