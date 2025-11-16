/**
 * Base Tool Abstraction
 *
 * Implements the declarative tool pattern:
 * 1. Schema - What the model sees (FunctionDeclaration)
 * 2. Validation - Check params before execution
 * 3. Execution - Actual implementation
 *
 * This separation enables:
 * - Testing validation independently
 * - Policy engine to check before execution
 * - Clear separation of concerns
 *
 * Reference: packages/core/src/tools/base-tool.ts
 * ADR: docs/adrs/003-declarative-tools.md (TODO)
 */

import type { FunctionDeclaration } from '@google/generative-ai';

/**
 * Result of tool execution
 */
export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Abstract base class for all tools
 *
 * Subclasses must implement:
 * - schema: FunctionDeclaration for the model
 * - validate: Check params before execution
 * - execute: Perform the actual operation
 */
export abstract class BaseTool {
  /**
   * Function declaration sent to the model
   *
   * This tells the model what the tool does and what parameters it accepts.
   * The model generates function calls based on this schema.
   */
  abstract get schema(): FunctionDeclaration;

  /**
   * Validate parameters before execution
   *
   * @param params - Parameters from model's function call
   * @returns null if valid, error message if invalid
   *
   * This runs BEFORE execute() to catch invalid inputs early.
   * Can check business logic (e.g., "path must be absolute")
   * that TypeScript types can't enforce.
   */
  abstract validate(params: Record<string, unknown>): string | null;

  /**
   * Execute the tool with validated parameters
   *
   * @param params - Parameters from model's function call
   * @returns Result with output or error
   *
   * This should ONLY be called after validate() returns null.
   * Performs the actual operation (file I/O, API call, etc.)
   */
  abstract execute(params: Record<string, unknown>): Promise<ToolResult>;
}
