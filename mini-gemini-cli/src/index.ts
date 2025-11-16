/**
 * Mini Gemini CLI - Entry Point
 *
 * Phase 0: Basic chat loop
 * - Read API key from environment
 * - Create GeminiClient
 * - Simple REPL (Read-Eval-Print-Loop)
 *
 * Usage:
 *   GEMINI_API_KEY=your_key npm start
 */

import { GeminiClient } from './client.js';
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

  console.log('Mini Gemini CLI - Phase 0: Basic Chat');
  console.log('Type your message and press Enter');
  console.log('Type "exit" to quit\n');

  // Create readline interface
  const rl = readline.createInterface({ input, output });

  // Simple REPL
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
      // Send message and get response
      const response = await client.sendMessage(userInput);
      console.log(`\nAssistant: ${response}\n`);
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
