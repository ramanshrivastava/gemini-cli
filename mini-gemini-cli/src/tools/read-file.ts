/**
 * Read File Tool
 *
 * Reads contents of a text file with optional line offset and limit.
 *
 * Simplified version (~80 lines) vs real implementation (296 lines).
 *
 * Missing from this version:
 * - Binary file detection
 * - Large file handling (streaming)
 * - Symlink resolution
 * - Line number alignment
 * - Invocation abstraction
 *
 * Reference: packages/core/src/tools/read-file.ts
 * Comparison: docs/comparisons/phase1-tools-comparison.md
 */

import { BaseTool, type ToolResult } from './base-tool.js';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { FunctionDeclaration } from '@google/generative-ai';

/**
 * Zod schema for runtime validation
 */
const ReadFileParamsSchema = z.object({
  file_path: z.string().describe('Absolute path to file'),
  offset: z.number().int().min(0).optional().describe('Line number to start from (0-indexed)'),
  limit: z.number().int().min(1).optional().describe('Number of lines to read'),
});

type ReadFileParams = z.infer<typeof ReadFileParamsSchema>;

export class ReadFileTool extends BaseTool {
  get schema(): FunctionDeclaration {
    return {
      name: 'read_file',
      description: 'Read contents of a file from disk',
      parameters: {
        type: 'OBJECT',
        properties: {
          file_path: {
            type: 'STRING',
            description: 'Absolute path to the file to read',
          },
          offset: {
            type: 'NUMBER',
            description: 'Line number to start reading from (0-indexed, optional)',
          },
          limit: {
            type: 'NUMBER',
            description: 'Maximum number of lines to read (optional)',
          },
        },
        required: ['file_path'],
      },
    };
  }

  validate(params: Record<string, unknown>): string | null {
    // Runtime validation with Zod
    const result = ReadFileParamsSchema.safeParse(params);
    if (!result.success) {
      return `Invalid parameters: ${result.error.message}`;
    }

    // Business logic validation
    const data = result.data;
    if (!data.file_path.startsWith('/')) {
      return 'file_path must be an absolute path (start with /)';
    }

    return null;
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    // Parse and validate
    const validated = ReadFileParamsSchema.parse(params);

    try {
      // Read entire file
      const content = await readFile(validated.file_path, 'utf-8');
      const lines = content.split('\n');

      // Apply offset and limit
      const start = validated.offset ?? 0;
      const end = validated.limit ? start + validated.limit : lines.length;
      const selectedLines = lines.slice(start, end);

      // Format with line numbers (1-indexed for display)
      const output = selectedLines
        .map((line, index) => {
          const lineNumber = start + index + 1;
          return `${lineNumber}→${line}`;
        })
        .join('\n');

      return {
        success: true,
        output,
      };
    } catch (error) {
      // Handle file system errors
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        output: '',
        error: `Failed to read file: ${errorMessage}`,
      };
    }
  }
}
