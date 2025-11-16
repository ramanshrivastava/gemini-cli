/**
 * Write File Tool
 *
 * Writes content to a text file, creating it if it doesn't exist.
 *
 * Simplified version (~100 lines) vs real implementation (200+ lines).
 *
 * Missing from this version:
 * - Backup of existing files
 * - Atomic writes (write to temp, then rename)
 * - Directory creation
 * - Size limits
 * - Permission checks
 *
 * Reference: packages/core/src/tools/write-file.ts
 */

import { BaseTool, type ToolResult } from './base-tool.js';
import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import type { FunctionDeclaration } from '@google/generative-ai';

/**
 * Zod schema for runtime validation
 */
const WriteFileParamsSchema = z.object({
  file_path: z.string().describe('Absolute path to file'),
  content: z.string().describe('Content to write'),
});

type WriteFileParams = z.infer<typeof WriteFileParamsSchema>;

export class WriteFileTool extends BaseTool {
  get schema(): FunctionDeclaration {
    return {
      name: 'write_file',
      description: 'Write content to a file, creating it if it does not exist',
      parameters: {
        type: 'OBJECT',
        properties: {
          file_path: {
            type: 'STRING',
            description: 'Absolute path to the file to write',
          },
          content: {
            type: 'STRING',
            description: 'Content to write to the file',
          },
        },
        required: ['file_path', 'content'],
      },
    };
  }

  validate(params: Record<string, unknown>): string | null {
    // Runtime validation with Zod
    const result = WriteFileParamsSchema.safeParse(params);
    if (!result.success) {
      return `Invalid parameters: ${result.error.message}`;
    }

    // Business logic validation
    const data = result.data;
    if (!data.file_path.startsWith('/')) {
      return 'file_path must be an absolute path (start with /)';
    }

    // Prevent writing huge files
    if (data.content.length > 1_000_000) {
      return 'content too large (max 1MB)';
    }

    return null;
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    // Parse and validate
    const validated = WriteFileParamsSchema.parse(params);

    try {
      // Write file
      await writeFile(validated.file_path, validated.content, 'utf-8');

      const bytes = Buffer.byteLength(validated.content, 'utf-8');
      const lines = validated.content.split('\n').length;

      return {
        success: true,
        output: `Successfully wrote ${bytes} bytes (${lines} lines) to ${validated.file_path}`,
      };
    } catch (error) {
      // Handle file system errors
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        output: '',
        error: `Failed to write file: ${errorMessage}`,
      };
    }
  }
}
