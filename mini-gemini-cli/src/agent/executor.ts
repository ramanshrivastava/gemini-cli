/**
 * Agent Executor
 *
 * The orchestration loop that runs the agent until task completion.
 *
 * Architecture:
 *   while (true) {
 *     1. Check termination conditions
 *     2. Send message to model
 *     3. Execute any requested tools
 *     4. If complete_task called, STOP
 *     5. Otherwise, continue with tool results
 *   }
 *
 * This is the "agentic loop" that enables multi-turn problem solving.
 *
 * Reference: packages/core/src/agents/executor.ts
 * ADR: docs/adrs/004-orchestration-loop.md (TODO)
 */

import type { GeminiClient } from '../client.js';
import type { AgentConfig, AgentResult, TerminateReason } from './types.js';
import { TerminateReason as TR } from './types.js';

export class AgentExecutor {
  constructor(
    private client: GeminiClient,
    private config: AgentConfig
  ) {}

  /**
   * Run the agent until task completion
   *
   * @param query - Initial user query
   * @returns Final result and metadata
   */
  async run(query: string): Promise<AgentResult> {
    const startTime = Date.now();
    let turnCount = 0;
    let currentMessage = query;
    let result = '';
    let terminateReason: TerminateReason = TR.ERROR;

    // Get tool schemas
    const toolSchemas = this.config.tools.map((t) => t.schema);

    // Main orchestration loop
    while (true) {
      // Check termination conditions BEFORE executing turn
      const terminationCheck = this.checkTermination(startTime, turnCount);
      if (terminationCheck) {
        terminateReason = terminationCheck;
        result = `Agent stopped: ${terminationCheck}`;
        break;
      }

      try {
        // Send message to model with tools
        const response = await this.client.sendMessage(
          currentMessage,
          toolSchemas
        );

        turnCount++;

        // Handle text response (model thinking out loud)
        if (response.text) {
          console.log(`\n[Turn ${turnCount}] Model: ${response.text}`);
        }

        // Handle function calls
        if (!response.functionCalls || response.functionCalls.length === 0) {
          // No function calls - model is done (or confused)
          // In real implementation, this might trigger a nudge
          result = response.text || 'No response from model';
          terminateReason = TR.ERROR;
          break;
        }

        // Process function calls
        const functionResponses = [];

        for (const fnCall of response.functionCalls) {
          console.log(`[Turn ${turnCount}] Tool: ${fnCall.name}`);

          // Special case: complete_task
          if (fnCall.name === 'complete_task') {
            result = (fnCall.args?.['result'] as string) || 'Task complete';
            terminateReason = TR.GOAL;

            // Exit the loop immediately
            return {
              result,
              terminateReason,
              turnCount,
              timeMs: Date.now() - startTime,
            };
          }

          // Find tool in config
          const tool = this.config.tools.find((t) => t.schema.name === fnCall.name);

          if (!tool) {
            functionResponses.push({
              name: fnCall.name,
              response: { error: `Tool '${fnCall.name}' not found` },
            });
            continue;
          }

          // Validate parameters
          const validationError = tool.validate(fnCall.args ?? {});
          if (validationError) {
            functionResponses.push({
              name: fnCall.name,
              response: { error: `Validation failed: ${validationError}` },
            });
            continue;
          }

          // Execute tool
          const toolResult = await tool.execute(fnCall.args ?? {});

          functionResponses.push({
            name: fnCall.name,
            response: toolResult.success
              ? { output: toolResult.output }
              : { error: toolResult.error },
          });
        }

        // Send function results back to model
        // This becomes the next "message" in the loop
        const followUpResponse = await this.client.sendFunctionResults(
          functionResponses,
          toolSchemas
        );

        // Model's response to tool results becomes next message
        if (followUpResponse.text) {
          currentMessage = followUpResponse.text;
        } else {
          // Model should respond after tool results
          // If it doesn't, something is wrong
          result = 'Model did not respond after tool execution';
          terminateReason = TR.ERROR;
          break;
        }

      } catch (error) {
        result = `Error: ${error instanceof Error ? error.message : String(error)}`;
        terminateReason = TR.ERROR;
        break;
      }
    }

    return {
      result,
      terminateReason,
      turnCount,
      timeMs: Date.now() - startTime,
    };
  }

  /**
   * Check if agent should terminate
   *
   * @returns TerminateReason if should stop, null otherwise
   */
  private checkTermination(
    startTime: number,
    turnCount: number
  ): TerminateReason | null {
    // Check turn limit
    if (turnCount >= this.config.maxTurns) {
      return TR.MAX_TURNS;
    }

    // Check time limit
    const elapsedMinutes = (Date.now() - startTime) / 60000;
    if (elapsedMinutes > this.config.maxTimeMinutes) {
      return TR.TIMEOUT;
    }

    return null;
  }
}
