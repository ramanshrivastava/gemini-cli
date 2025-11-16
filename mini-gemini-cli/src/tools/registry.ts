/**
 * Tool Registry
 *
 * Central registry for managing tools:
 * - Register tools by name
 * - Lookup tool for execution
 * - Generate function declarations for Gemini API
 *
 * This enables:
 * - Dynamic tool loading
 * - Name-based dispatch from model's function calls
 * - Centralized tool management
 *
 * Reference: packages/core/src/tools/tool-registry.ts
 */

import type { BaseTool } from './base-tool.js';
import type { FunctionDeclaration } from '@google/generative-ai';

export class ToolRegistry {
  private tools = new Map<string, BaseTool>();

  /**
   * Register a tool
   *
   * @param tool - Tool to register
   * @throws Error if tool name is already registered
   */
  register(tool: BaseTool): void {
    const name = tool.schema.name;

    if (this.tools.has(name)) {
      throw new Error(`Tool '${name}' is already registered`);
    }

    this.tools.set(name, tool);
  }

  /**
   * Get tool by name
   *
   * @param name - Tool name from model's function call
   * @returns Tool instance
   * @throws Error if tool not found
   */
  get(name: string): BaseTool {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new Error(`Tool '${name}' not found in registry`);
    }

    return tool;
  }

  /**
   * Check if tool exists
   *
   * @param name - Tool name
   * @returns true if registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all registered tools
   *
   * @returns Array of all tools
   */
  listAll(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get function declarations for all tools
   *
   * This is sent to the Gemini API to tell the model
   * what tools are available.
   *
   * @returns Array of function declarations
   */
  getFunctionDeclarations(): FunctionDeclaration[] {
    return this.listAll().map((tool) => tool.schema);
  }

  /**
   * Get count of registered tools
   */
  get size(): number {
    return this.tools.size;
  }
}
