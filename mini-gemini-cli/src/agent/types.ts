/**
 * Agent Types
 *
 * Type definitions for the agent orchestration system.
 *
 * Key concepts:
 * - AgentConfig: Configuration for agent behavior
 * - TerminateReason: Why did the agent stop?
 * - AgentResult: What did the agent produce?
 *
 * Reference: packages/core/src/agents/types.ts
 */

import type { BaseTool } from '../tools/base-tool.js';

/**
 * Why did the agent terminate?
 */
export enum TerminateReason {
  /**
   * Agent successfully completed the task (called complete_task)
   */
  GOAL = 'GOAL',

  /**
   * Exceeded maximum number of turns
   */
  MAX_TURNS = 'MAX_TURNS',

  /**
   * Exceeded maximum time limit
   */
  TIMEOUT = 'TIMEOUT',

  /**
   * Unrecoverable error occurred
   */
  ERROR = 'ERROR',
}

/**
 * Configuration for agent execution
 */
export interface AgentConfig {
  /**
   * Maximum number of turns before giving up
   * (default: 20)
   */
  maxTurns: number;

  /**
   * Maximum execution time in minutes
   * (default: 5)
   */
  maxTimeMinutes: number;

  /**
   * Tools available to the agent
   */
  tools: BaseTool[];
}

/**
 * Result from agent execution
 */
export interface AgentResult {
  /**
   * Final result (if successful)
   */
  result: string;

  /**
   * Why did the agent stop?
   */
  terminateReason: TerminateReason;

  /**
   * Number of turns executed
   */
  turnCount: number;

  /**
   * Time taken in milliseconds
   */
  timeMs: number;
}
