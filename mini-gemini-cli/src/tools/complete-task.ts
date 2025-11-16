/**
 * Complete Task Tool
 *
 * Special tool that signals the agent has completed its task.
 * This is the termination mechanism for the orchestration loop.
 *
 * When the model calls this tool, it means:
 * - The user's request has been fulfilled
 * - No more actions are needed
 * - The result is ready to return
 *
 * This is NOT a tool that executes like read_file or write_file.
 * Instead, it's a signal to the orchestrator to stop the loop.
 *
 * Reference: packages/core/src/tools/complete-task.ts (Real uses submit_final_output)
 */

import { BaseTool, type ToolResult } from './base-tool.js';
import { z } from 'zod';
import type { FunctionDeclaration } from '@google/generative-ai';

/**
 * Zod schema for runtime validation
 */
const CompleteTaskParamsSchema = z.object({
  result: z.string().describe('Final result to return to user'),
});

type CompleteTaskParams = z.infer<typeof CompleteTaskParamsSchema>;

export class CompleteTaskTool extends BaseTool {
  get schema(): FunctionDeclaration {
    return {
      name: 'complete_task',
      description:
        'Call this when the task is complete and you have a final result to return to the user. ' +
        'This signals that no more actions are needed.',
      parameters: {
        type: 'OBJECT',
        properties: {
          result: {
            type: 'STRING',
            description:
              'The final result or answer to return to the user. ' +
              'This should be a complete, natural language response.',
          },
        },
        required: ['result'],
      },
    };
  }

  validate(params: Record<string, unknown>): string | null {
    // Runtime validation with Zod
    const result = CompleteTaskParamsSchema.safeParse(params);
    if (!result.success) {
      return `Invalid parameters: ${result.error.message}`;
    }

    // Ensure result is not empty
    const data = result.data;
    if (!data.result.trim()) {
      return 'result cannot be empty';
    }

    return null;
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    // Parse and validate
    const validated = CompleteTaskParamsSchema.parse(params);

    // This tool doesn't "do" anything except return the result
    // The orchestrator will detect this call and stop the loop
    return {
      success: true,
      output: validated.result,
    };
  }
}
