# Learning Checkpoint 2: Tool System & Function Calling

**After Phase 1 of the Learning Framework**

This checkpoint verifies your understanding of:
- How Gemini API function calling works
- The declarative tool pattern
- Validation vs. execution separation
- Zod runtime validation

---

## Part 1: Conceptual Understanding

### Question 1: Function Calling Mechanics

**Scenario**: You send this to the Gemini API:

```typescript
const response = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: 'Read the file config.json' }] }],
  tools: [{
    functionDeclarations: [{
      name: 'read_file',
      description: 'Read a file from disk',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path to file' }
        },
        required: ['file_path']
      }
    }]
  }]
});
```

**Question**: What does the model return?

A) The contents of `config.json`
B) A function call request: `{ name: 'read_file', args: { file_path: 'config.json' } }`
C) JavaScript code: `fs.readFileSync('config.json')`
D) An error because the model can't read files

<details>
<summary>Answer</summary>

**B) A function call request**

The model generates tokens representing a function call, not the actual file contents. The response looks like:

```typescript
{
  candidates: [{
    content: {
      role: 'model',
      parts: []
    },
    functionCalls: [
      {
        name: 'read_file',
        args: { file_path: 'config.json' }
      }
    ]
  }]
}
```

**Your code** must then:
1. Extract the function call
2. Execute the `read_file` tool with those args
3. Send the result back to the model as the next message

**Common Misconception**: The model doesn't execute tools itself. It only generates structured requests for you to execute.
</details>

---

### Question 2: Validation vs. Execution

**Given this tool**:

```typescript
class WriteFileTool {
  validate(params: { file_path: string; content: string }): string | null {
    if (!params.file_path.startsWith('/')) {
      return 'file_path must be absolute';
    }
    if (params.content.length > 1_000_000) {
      return 'content too large (max 1MB)';
    }
    return null;
  }

  async execute(params: { file_path: string; content: string }): Promise<ToolResult> {
    await writeFile(params.file_path, params.content);
    return { success: true, output: 'File written' };
  }
}
```

**Question**: What happens if you call `execute()` without calling `validate()` first?

A) Runtime error because params are invalid
B) File is written anyway (validation is optional)
C) TypeScript prevents this at compile time
D) Depends on the params - might work, might crash

<details>
<summary>Answer</summary>

**D) Depends on the params - might work, might crash**

`validate()` checks **business logic** (absolute paths, size limits), but doesn't prevent execution.

If you call:
```typescript
tool.execute({ file_path: '../sneaky.txt', content: 'x'.repeat(2_000_000) });
```

**What happens**:
- ❌ No TypeScript error (types are satisfied)
- ❌ No runtime error (Node.js will happily write the file)
- ✅ File is written to an unintended location with huge content
- ❌ Validation was bypassed!

**The Lesson**: Validation is a **contract**, not an **enforcement**. The caller must respect it:

```typescript
// Correct usage
const error = tool.validate(params);
if (error) {
  return { success: false, error };
}
return await tool.execute(params);
```

**Alternative**: Enforce validation inside `execute()`:
```typescript
async execute(params: Params): Promise<ToolResult> {
  const error = this.validate(params); // Call validate first
  if (error) {
    throw new Error(error);
  }

  await writeFile(params.file_path, params.content);
  return { success: true, output: 'File written' };
}
```

Real Gemini CLI uses the **separation** approach (validate separate from execute) because:
- Validation can run before asking user for approval
- Validation can be tested independently
- Executor has control over the flow
</details>

---

### Question 3: TypeScript Types vs. Zod Schemas

**Code**:

```typescript
interface Params {
  file_path: string;
  limit?: number;
}

const ParamsSchema = z.object({
  file_path: z.string(),
  limit: z.number().optional(),
});

function processParams(params: unknown) {
  // Option A: TypeScript assertion
  const typed = params as Params;
  console.log(typed.file_path.toUpperCase());

  // Option B: Zod parse
  const validated = ParamsSchema.parse(params);
  console.log(validated.file_path.toUpperCase());
}
```

**Question**: If `params = { file_path: 123, limit: "hello" }`, what happens?

A) Option A crashes, Option B crashes
B) Option A works, Option B crashes
C) Option A crashes, Option B throws validation error
D) Both work because TypeScript validates the types

<details>
<summary>Answer</summary>

**A) Option A crashes, Option B throws validation error**

**Option A (Type Assertion)**:
```typescript
const typed = params as Params; // TypeScript: "Trust me, this is Params"
console.log(typed.file_path.toUpperCase()); // Runtime error!
// TypeError: typed.file_path.toUpperCase is not a function
// (because file_path is 123, not a string)
```

Type assertions don't validate - they just tell TypeScript to trust you.

**Option B (Zod Parse)**:
```typescript
const validated = ParamsSchema.parse(params); // Validates at runtime!
// ZodError: [
//   { path: ['file_path'], message: 'Expected string, received number' },
//   { path: ['limit'], message: 'Expected number, received string' }
// ]
```

Zod validates at **runtime**, catching the error before executing business logic.

**Key Insight**:
- **TypeScript types**: Compile-time only, erased at runtime
- **Zod schemas**: Runtime validation, throws before bad data propagates

**Real-world scenario**:
```typescript
// Model calls tool with wrong types (model hallucinated)
const modelResponse = {
  functionCalls: [{
    name: 'read_file',
    args: { file_path: 123 } // OOPS: model gave number instead of string
  }]
};

// Without Zod: Crashes later when trying to read "123" as a path
const result = await readFile(args.file_path); // Runtime error

// With Zod: Fails fast with clear error
const validated = ParamsSchema.safeParse(args);
if (!validated.success) {
  return { error: 'Invalid params from model: expected string, got number' };
}
```

This is why Gemini CLI uses Zod **everywhere** for tool params.
</details>

---

## Part 2: Practical Implementation

### Exercise 1: Implement GrepTool

**Task**: Implement a tool that searches for text in a file.

**Requirements**:
- **Parameters**:
  - `file_path: string` (required)
  - `pattern: string` (required, regex pattern)
  - `case_sensitive: boolean` (optional, default false)

- **Validation**:
  - `file_path` must be absolute
  - `pattern` must be valid regex

- **Execution**:
  - Read file
  - Find all lines matching pattern
  - Return line numbers and content

**Starter Code**:

```typescript
import { BaseTool, type ToolResult } from './base-tool.js';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';

const GrepParamsSchema = z.object({
  file_path: z.string(),
  pattern: z.string(),
  case_sensitive: z.boolean().optional(),
});

type GrepParams = z.infer<typeof GrepParamsSchema>;

export class GrepTool extends BaseTool {
  get schema(): FunctionDeclaration {
    // TODO: Implement
  }

  validate(params: Record<string, unknown>): string | null {
    // TODO: Implement
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    // TODO: Implement
  }
}
```

<details>
<summary>Solution</summary>

```typescript
import { BaseTool, type ToolResult } from './base-tool.js';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { FunctionDeclaration } from '@google/genai';

const GrepParamsSchema = z.object({
  file_path: z.string(),
  pattern: z.string(),
  case_sensitive: z.boolean().optional().default(false),
});

type GrepParams = z.infer<typeof GrepParamsSchema>;

export class GrepTool extends BaseTool {
  get schema(): FunctionDeclaration {
    return {
      name: 'grep',
      description: 'Search for a pattern in a file',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Absolute path to file',
          },
          pattern: {
            type: 'string',
            description: 'Regular expression pattern to search for',
          },
          case_sensitive: {
            type: 'boolean',
            description: 'Whether search should be case-sensitive (default: false)',
          },
        },
        required: ['file_path', 'pattern'],
      },
    };
  }

  validate(params: Record<string, unknown>): string | null {
    // Validate with Zod
    const result = GrepParamsSchema.safeParse(params);
    if (!result.success) {
      return result.error.message;
    }

    // Business logic validation
    if (!result.data.file_path.startsWith('/')) {
      return 'file_path must be absolute';
    }

    // Validate regex pattern
    try {
      new RegExp(result.data.pattern);
    } catch (e) {
      return `Invalid regex pattern: ${e.message}`;
    }

    return null;
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const validated = GrepParamsSchema.parse(params);

    try {
      // Read file
      const content = await readFile(validated.file_path, 'utf-8');
      const lines = content.split('\n');

      // Create regex
      const flags = validated.case_sensitive ? 'g' : 'gi';
      const regex = new RegExp(validated.pattern, flags);

      // Find matches
      const matches = lines
        .map((line, index) => ({ line, number: index + 1 }))
        .filter(({ line }) => regex.test(line));

      if (matches.length === 0) {
        return {
          success: true,
          output: `No matches found for pattern "${validated.pattern}"`,
        };
      }

      // Format output
      const output = matches
        .map(({ line, number }) => `${number}:${line}`)
        .join('\n');

      return {
        success: true,
        output: `Found ${matches.length} match(es):\n${output}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
```

**Testing**:
```typescript
const tool = new GrepTool();

// Test validation
console.log(tool.validate({ file_path: 'relative.txt', pattern: 'foo' }));
// Output: "file_path must be absolute"

console.log(tool.validate({ file_path: '/test.txt', pattern: '[invalid' }));
// Output: "Invalid regex pattern: Unterminated character class"

// Test execution
const result = await tool.execute({
  file_path: '/tmp/test.txt',
  pattern: 'error',
  case_sensitive: false,
});
console.log(result);
// Output: { success: true, output: "Found 2 match(es):\n5:Error occurred\n12:Another error" }
```
</details>

---

### Exercise 2: Model Integration

**Task**: Integrate your GrepTool with the Gemini API.

**Scenario**: User asks "Find all occurrences of 'TODO' in /src/index.ts"

**Your code should**:
1. Send message to model with GrepTool schema
2. Model returns function call
3. Execute GrepTool
4. Send result back to model
5. Model responds with natural language summary

**Starter Code**:

```typescript
import { createClient } from '@google/genai';
import { GrepTool } from './tools/grep.js';

async function main() {
  const client = createClient({ apiKey: process.env.GEMINI_API_KEY! });
  const tool = new GrepTool();

  const response = await client.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{
      role: 'user',
      parts: [{ text: "Find all occurrences of 'TODO' in /src/index.ts" }]
    }],
    tools: [{
      functionDeclarations: [tool.schema]
    }]
  });

  // TODO: Extract function call, execute tool, send result back
}
```

<details>
<summary>Solution</summary>

```typescript
import { createClient, type Content } from '@google/genai';
import { GrepTool } from './tools/grep.js';

async function main() {
  const client = createClient({ apiKey: process.env.GEMINI_API_KEY! });
  const tool = new GrepTool();
  const history: Content[] = [];

  // Initial user message
  const userMessage = "Find all occurrences of 'TODO' in /src/index.ts";
  console.log(`User: ${userMessage}\n`);

  history.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  // Send to model with tool schema
  const response1 = await client.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: history,
    tools: [{
      functionDeclarations: [tool.schema]
    }]
  });

  const modelResponse1 = response1.candidates[0].content;
  history.push(modelResponse1);

  // Check if model wants to call a tool
  if (modelResponse1.parts[0].functionCall) {
    const fnCall = modelResponse1.parts[0].functionCall;
    console.log(`Model requested: ${fnCall.name}(${JSON.stringify(fnCall.args)})\n`);

    // Validate params
    const validationError = tool.validate(fnCall.args);
    if (validationError) {
      console.error(`Validation error: ${validationError}`);
      return;
    }

    // Execute tool
    const result = await tool.execute(fnCall.args);
    console.log(`Tool result: ${result.output}\n`);

    // Send result back to model
    history.push({
      role: 'user',
      parts: [{
        functionResponse: {
          name: fnCall.name,
          response: { output: result.output }
        }
      }]
    });

    // Get model's natural language response
    const response2 = await client.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: history,
      tools: [{
        functionDeclarations: [tool.schema]
      }]
    });

    const finalResponse = response2.candidates[0].content.parts[0].text;
    console.log(`Model: ${finalResponse}`);
  } else {
    // Model responded with text, no tool call
    console.log(`Model: ${modelResponse1.parts[0].text}`);
  }
}

main();
```

**Expected Output**:
```
User: Find all occurrences of 'TODO' in /src/index.ts

Model requested: grep({"file_path":"/src/index.ts","pattern":"TODO","case_sensitive":false})

Tool result: Found 3 match(es):
12:// TODO: Implement error handling
45:// TODO: Add validation
78:// TODO: Refactor this function

Model: I found 3 TODO items in /src/index.ts:
- Line 12: Implement error handling
- Line 45: Add validation
- Line 78: Refactor this function

Would you like me to help with any of these?
```

**Key Points**:
1. Function call is in `parts[0].functionCall`, not a separate field
2. Tool result goes back as `functionResponse` (not text)
3. Model converts tool output to natural language in second turn
</details>

---

## Part 3: Design Questions

### Question 4: Tool Registry

**Scenario**: You have 10 tools (read_file, write_file, grep, glob, ls, edit, terminal, web_fetch, etc.)

**Question**: How should you organize tool lookup?

Design a `ToolRegistry` class that:
- Registers tools by name
- Retrieves tool by name
- Lists all available tools
- Generates function declarations for all tools

<details>
<summary>Solution</summary>

```typescript
import type { BaseTool } from './base-tool.js';
import type { FunctionDeclaration } from '@google/genai';

export class ToolRegistry {
  private tools = new Map<string, BaseTool>();

  register(tool: BaseTool): void {
    const name = tool.schema.name;
    if (this.tools.has(name)) {
      throw new Error(`Tool ${name} is already registered`);
    }
    this.tools.set(name, tool);
  }

  get(name: string): BaseTool {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }
    return tool;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  listAll(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  getFunctionDeclarations(): FunctionDeclaration[] {
    return this.listAll().map(tool => tool.schema);
  }
}

// Usage
const registry = new ToolRegistry();
registry.register(new ReadFileTool());
registry.register(new WriteFileTool());
registry.register(new GrepTool());

// Get tool by name (from model's function call)
const tool = registry.get('read_file');
const result = await tool.execute({ file_path: '/test.txt' });

// Get all schemas for Gemini API
const response = await client.models.generateContent({
  contents: history,
  tools: [{
    functionDeclarations: registry.getFunctionDeclarations()
  }]
});
```

**Real Gemini CLI Reference**: `/home/user/gemini-cli/packages/core/src/tools/tool-registry.ts`
</details>

---

### Question 5: Error Recovery

**Scenario**: The model calls `read_file` with a file that doesn't exist.

**Question**: What should you do?

A) Throw an error and crash
B) Return error to model, let it handle it
C) Retry with a different file path
D) Ask user what to do

<details>
<summary>Answer</summary>

**B) Return error to model, let it handle it**

The model should be in the loop for error recovery.

**Bad Approach (A)**:
```typescript
const result = await tool.execute({ file_path: '/nonexistent.txt' });
if (!result.success) {
  throw new Error(result.error); // Crash!
}
```

**Good Approach (B)**:
```typescript
const result = await tool.execute({ file_path: '/nonexistent.txt' });

// Send error back to model
history.push({
  role: 'user',
  parts: [{
    functionResponse: {
      name: 'read_file',
      response: {
        error: result.error, // "ENOENT: no such file or directory"
      }
    }
  }]
});

// Model can now decide what to do:
// - "Let me list the directory to find the right file"
// - "I apologize, that file doesn't exist. Could you provide the correct path?"
// - "Let me create the file first with write_file"
```

**Example Conversation**:
```
User: Read config.json
Model: [calls read_file with /config.json]
Tool: Error: ENOENT: no such file or directory
Model: That file doesn't exist. Let me check what files are in the directory.
Model: [calls ls with /]
Tool: [lists files, including config.yaml]
Model: I see there's a config.yaml file. Did you mean that one?
```

**Why this works**:
- Model has full context (can try alternatives)
- User experience is conversational
- System is resilient to mistakes

**Real Gemini CLI behavior**: Errors are returned as tool results, model decides next step.
</details>

---

## Part 4: Reflection

### Self-Assessment

Rate your understanding (1-5) of:

- [ ] How Gemini API function calling works
- [ ] Why validation is separate from execution
- [ ] When to use Zod vs. TypeScript types
- [ ] How to implement the declarative tool pattern
- [ ] Error handling strategies

**If any rating is < 4**: Review the corresponding section and try the exercises again.

---

### Advanced Challenge

**Task**: Implement a `CompositeTool` that chains multiple tools.

**Example**: A tool that:
1. Searches for a pattern in a file (grep)
2. Reads the matching lines in context (read_file with offset)
3. Returns a formatted report

<details>
<summary>Hint</summary>

```typescript
export class SearchAndContextTool extends BaseTool {
  constructor(
    private grepTool: GrepTool,
    private readTool: ReadFileTool,
  ) {
    super();
  }

  async execute(params: { file_path: string; pattern: string }): Promise<ToolResult> {
    // 1. Grep for pattern
    const grepResult = await this.grepTool.execute({
      file_path: params.file_path,
      pattern: params.pattern,
    });

    // 2. For each match, read surrounding context
    const matches = this.parseGrepOutput(grepResult.output);
    const contextsconst contexts = [];
    for (const match of matches) {
      const contextResult = await this.readTool.execute({
        file_path: params.file_path,
        offset: Math.max(0, match.lineNumber - 5),
        limit: 11, // 5 before + match + 5 after
      });
      contexts.push(contextResult.output);
    }

    // 3. Format report
    return {
      success: true,
      output: this.formatReport(contexts),
    };
  }
}
```

This demonstrates **tool composition** - a more advanced pattern.
</details>

---

**End of Checkpoint 2**

After completing this checkpoint, you should be ready to move on to **Phase 2: Orchestration Loop**.
