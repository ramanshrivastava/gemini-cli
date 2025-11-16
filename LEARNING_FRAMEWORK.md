# Gemini CLI Learning Framework
## A Comprehensive Guide to Understanding and Reimplementing from Scratch

> **Inspired by**: The reasoning-based approach used in Python interpreter design guides
> **Goal**: Learn by building a simplified version (mini-gemini-cli) while understanding every architectural decision through historical context and ADRs

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Historical Timeline](#historical-timeline)
3. [Learning Philosophy](#learning-philosophy)
4. [Phase-by-Phase Implementation](#phase-by-phase-implementation)
5. [Architecture Decision Records (ADR) Template](#adr-template)
6. [Comparative Analysis Framework](#comparative-analysis)
7. [Learning Checkpoints](#learning-checkpoints)
8. [Development Tools](#development-tools)

---

## Architecture Overview

### The Execution Pipeline

```
┌─────────────┐
│ User Input  │
│ "Fix bug"   │
└──────┬──────┘
       │
       v
┌─────────────────────────────────────────────┐
│  CLI Package (packages/cli)                 │
│  - React/Ink UI                             │
│  - Input handling                           │
│  - Display rendering                        │
└──────┬──────────────────────────────────────┘
       │
       v
┌─────────────────────────────────────────────┐
│  Core Package (packages/core)               │
│  ┌──────────────────────────────────┐      │
│  │ Orchestration Loop (executor.ts) │      │
│  │                                   │      │
│  │  while (true) {                   │      │
│  │    1. Send message to Gemini API  │      │
│  │    2. Get response (text/tools)   │      │
│  │    3. Execute tools if requested  │      │
│  │    4. Send results back           │      │
│  │    5. Check if complete_task      │      │
│  │  }                                │      │
│  └──────────────────────────────────┘      │
│                                             │
│  ┌──────────────────────────────────┐      │
│  │ Turn Management (turn.ts)        │      │
│  │ - Single model call              │      │
│  │ - Stream response chunks         │      │
│  │ - Extract function calls         │      │
│  │ - Yield events                   │      │
│  └──────────────────────────────────┘      │
│                                             │
│  ┌──────────────────────────────────┐      │
│  │ GeminiChat (geminiChat.ts)       │      │
│  │ - Wrapper around @google/genai   │      │
│  │ - Retry logic                    │      │
│  │ - History management             │      │
│  └──────────────────────────────────┘      │
│                                             │
│  ┌──────────────────────────────────┐      │
│  │ Tool Registry                     │      │
│  │ - read-file, write-file, edit    │      │
│  │ - grep, glob, ls                 │      │
│  │ - terminal (bash execution)      │      │
│  └──────────────────────────────────┘      │
└──────┬──────────────────────────────────────┘
       │
       v
┌─────────────────────────────────────────────┐
│  Gemini API (@google/genai SDK)             │
│  - Sends function declarations (schemas)    │
│  - Receives function calls (tokens)         │
│  - Streams responses                        │
└─────────────────────────────────────────────┘
```

### Key Design Principles

1. **Declarative Tool Pattern**: Tools separate validation, execution, and policy
2. **Event-Driven Architecture**: Async generators yielding events
3. **Type Safety**: Strict TypeScript with Zod runtime validation
4. **Modularity**: Monorepo with clear package boundaries
5. **User Control**: Policy engine for tool approval

---

## Historical Timeline

### Phase 0: Pre-Public Development (Before April 15, 2025)
**Context**: Internal Google development (Gerrit-based workflow)

**Evidence**:
- Initial commit has 7,920 lines, 54 files
- Already includes: 7 tools, React/Ink UI, terminal emulation (960 lines)
- References to "go/" internal links removed in commit a2807272
- Author: Taylor Mullen (ntaylormullen@google.com)

**Key Insight**: Gemini CLI was NOT built in public from scratch—it was a mature prototype migrated from internal repository

---

### Phase 1: Public Launch & Stabilization (April 15-18, 2025)

**Commits**: `add233c5` → `24371a39` (30+ commits in 3 days)

**What existed on Day 1** (add233c5):
```
packages/cli/src/
├── core/
│   ├── GeminiClient.ts        (383 lines) - API wrapper
│   ├── geminiStreamProcessor.ts (142 lines) - Stream handler
│   ├── historyUpdater.ts      (173 lines) - Chat history
│   └── prompts.ts             (93 lines) - System prompts
├── tools/
│   ├── ls.tool.ts             (306 lines)
│   ├── read-file.tool.ts      (296 lines)
│   ├── grep.tool.ts           (493 lines)
│   ├── glob.tool.ts           (227 lines)
│   ├── edit.tool.ts           (369 lines)
│   ├── write-file.tool.ts     (201 lines)
│   └── terminal.tool.ts       (960 lines) - Full terminal emulator!
├── ui/
│   ├── App.tsx                (90 lines) - React/Ink entry
│   └── components/            (13 components)
└── utils/
    └── BackgroundTerminalAnalyzer.ts (325 lines)
```

**Critical commits**:
- **f10aaf7e** (April 16): Fix 429 rate limit crash
  - Added global `process.on('unhandledRejection')` handler
  - Workaround for @google/genai SDK bug
  - **ADR Insight**: Pragmatic engineering over purity

- **a2807272** (April 17): Remove Gerrit references
  - Cleaned go/ links, internal docs
  - Public-facing transition

- **24371a39** (April 18): **Major Architecture Refactor**
  - "Take the turn management out of GeminiClient"
  - Separated concerns: GeminiClient (API) vs. Turn (conversation)
  - **ADR Insight**: Extracted turn.ts as separate abstraction

---

### Phase 2: Modularization (April 18 - May 2025)

**Key commits**:
- **#55** (3fce6cea): "Starting to modularize into separate cli / server packages"
  - Split monolithic package into packages/cli and packages/core
  - Established current architecture

- **#61** (99f5ed9e): "Minimal container setup"
  - Docker/Podman support
  - Sandbox execution environment

- **#31** (3ed61f1f): "Web fetch tool"
  - Extended tool system
  - Demonstrated extensibility

**Architecture Evolution**:
```
Before #55:                  After #55:
packages/cli/               packages/
├── src/                    ├── cli/
│   ├── core/              │   └── src/
│   ├── tools/             │       └── (UI only)
│   └── ui/                └── core/
                                └── src/
                                    ├── agents/
                                    ├── tools/
                                    └── core/
```

---

### Phase 3: Declarative Agent Framework (July - September 2025)

**Key commits**:
- **#9778** (794d92a7): "Introduce Declarative Agent Framework"
  - Added AgentDefinition interface
  - Created executor.ts orchestration loop
  - Introduced `complete_task` tool pattern

- **#10377** (a6af7bbb): "Implement submit_final_output tool"
  - Formalized agent completion
  - Output validation with Zod schemas

- **#9988** (331ae7db): "Enable subagents"
  - Agent composition (agents can call agents)
  - Recursive orchestration

**Files Created**:
- `/home/user/gemini-cli/packages/core/src/agents/types.ts` (170 lines)
- `/home/user/gemini-cli/packages/core/src/agents/executor.ts` (orchestration loop)

**ADR Insight**: Moved from imperative "call API until done" to declarative "define agent, run until submit_final_output"

---

### Phase 4: Policy Engine & Security (November - December 2025)

**Key commits**:
- **#11523** (bf80263b): "Implement message bus and policy engine"
  - Tool approval workflow
  - User confirmation for destructive operations

- **#11992** (064edc52): "Config-based policy engine with TOML"
  - Declarative security rules
  - Priority-based policy evaluation

- **#12325** (ffc5e4d0): "Refactor PolicyEngine to Core Package"
  - Moved from CLI to Core (reusable)

- **#12646** (c81a02f8): "Integrate DiscoveredTool with Policy Engine"
  - MCP tools subject to policies

**Architecture Impact**:
```typescript
// Before: Tools executed immediately
await tool.execute(params);

// After: Tools require policy approval
const approval = await policyEngine.requestApproval(tool, params);
if (approval.granted) {
  await tool.execute(params);
}
```

---

### Phase 5: MCP Integration (Throughout 2025)

**Key commits**:
- **#12239** (cc081337): "Support for reloading extensions - mcp servers only"
- **#12413** (da4fa5ad): "Extensions MCP refactor"
- **#10194** (ed9f714f): "Run MCP prompt commands in non-interactive mode"

**What is MCP?**
- Model Context Protocol (Anthropic's standard)
- Allows external tools/servers to extend the CLI
- Gemini CLI adapted it for Google's ecosystem

---

## Learning Philosophy

### Why Rebuild from Scratch?

1. **Deep Understanding**: You can't truly understand code by reading—only by writing
2. **Historical Context**: Knowing WHY decisions were made prevents cargo-culting
3. **Comparative Learning**: Mini vs. Real highlights trade-offs
4. **Incremental Complexity**: Build features in order of dependency

### The ADR-Driven Approach

Every implementation phase will document:
- **Context**: What problem are we solving?
- **Decision**: What approach did we choose?
- **Rationale**: Why this way and not alternatives?
- **Gemini CLI Reference**: Where is this in the real codebase?
- **Trade-offs**: What did we gain/lose?
- **Learning Outcomes**: What concepts does this teach?

---

## Phase-by-Phase Implementation

### Phase 0: Foundation (TypeScript, Node.js, Gemini API)

**Duration**: 1 day

**Learning Outcomes**:
- Understand TypeScript compilation (TS → JS type erasure)
- Set up project structure
- Make first Gemini API call

**Deliverables**:
```
mini-gemini-cli/
├── package.json
├── tsconfig.json
├── src/
│   └── client.ts          # Basic Gemini API wrapper
└── docs/
    └── adrs/
        └── 001-typescript-setup.md
```

**Checkpoint Questions**:
1. What happens to TypeScript types at runtime?
2. Why use `"module": "NodeNext"`?
3. What is the difference between `Content` and `Part` in @google/genai?

**Code (~100 lines)**:
```typescript
// src/client.ts
import { createClient, type Content } from '@google/genai';

export class GeminiClient {
  private client = createClient({ apiKey: process.env.GEMINI_API_KEY! });
  private history: Content[] = [];

  async sendMessage(text: string): Promise<string> {
    const response = await this.client.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [...this.history, { role: 'user', parts: [{ text }] }],
    });

    const reply = response.candidates[0].content;
    this.history.push({ role: 'user', parts: [{ text }] });
    this.history.push(reply);

    return reply.parts[0].text || '';
  }
}
```

**Compare to Real**:
- Real: `/home/user/gemini-cli/packages/core/src/core/geminiChat.ts` (hundreds of lines with retry, compression, error handling)
- Mini: 20 lines, no error handling
- **Trade-off**: Simplicity vs. Production-readiness

---

### Phase 1: Tool Execution Basics

**Duration**: 2 days

**Learning Outcomes**:
- Understand function calling in Gemini API
- Implement declarative tool pattern
- Separate validation from execution

**Deliverables**:
```
src/
├── client.ts              (Modified to handle function calls)
├── tools/
│   ├── base-tool.ts       (Abstract base class)
│   └── read-file.ts       (First concrete tool)
└── registry.ts            (Tool lookup)

docs/adrs/
├── 002-function-calling.md
└── 003-declarative-tools.md
```

**ADR: Why Declarative Tools?**

**Context**: Need to execute tools based on model requests

**Decision**: Separate tool into three concerns:
1. **Schema** (FunctionDeclaration): What the model sees
2. **Validation**: Check params before execution
3. **Execution**: Actual file I/O

**Rationale**:
- Model doesn't need execution details
- Validation can run in isolation (testing)
- Execution can be mocked/sandboxed

**Gemini CLI Reference**: `/home/user/gemini-cli/packages/core/src/tools/read-file.ts:45-139`

**Code (~200 lines)**:
```typescript
// src/tools/base-tool.ts
import type { FunctionDeclaration } from '@google/genai';

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export abstract class BaseTool {
  abstract get schema(): FunctionDeclaration;
  abstract validate(params: Record<string, unknown>): string | null;
  abstract execute(params: Record<string, unknown>): Promise<ToolResult>;
}

// src/tools/read-file.ts
import { BaseTool } from './base-tool.js';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';

const ReadFileParamsSchema = z.object({
  file_path: z.string().describe('Absolute path to file'),
  offset: z.number().optional(),
  limit: z.number().optional(),
});

export class ReadFileTool extends BaseTool {
  get schema(): FunctionDeclaration {
    return {
      name: 'read_file',
      description: 'Read contents of a file',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Absolute path' },
          offset: { type: 'number', description: 'Line to start from' },
          limit: { type: 'number', description: 'Number of lines' },
        },
        required: ['file_path'],
      },
    };
  }

  validate(params: Record<string, unknown>): string | null {
    const result = ReadFileParamsSchema.safeParse(params);
    if (!result.success) {
      return result.error.message;
    }

    // Additional validation
    if (!result.data.file_path.startsWith('/')) {
      return 'file_path must be absolute';
    }

    return null;
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const validated = ReadFileParamsSchema.parse(params);

    try {
      const content = await readFile(validated.file_path, 'utf-8');
      const lines = content.split('\n');

      const start = validated.offset ?? 0;
      const end = validated.limit ? start + validated.limit : lines.length;
      const selectedLines = lines.slice(start, end);

      return {
        success: true,
        output: selectedLines.map((line, i) => `${start + i + 1}→${line}`).join('\n'),
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

**Checkpoint Quiz**:
1. Why separate `validate()` from `execute()`?
2. What happens if validation fails but execute() is called anyway?
3. How does Zod differ from TypeScript types?

**Compare to Real**:
| Aspect | Mini (Phase 1) | Real Gemini CLI |
|--------|---------------|-----------------|
| Lines | ~80 | 296 lines |
| Features | Basic read | Chunking, error recovery, binary detection |
| Policy | None | Integrated with PolicyEngine |
| Testing | Manual | Comprehensive test suite |

---

### Phase 2: Orchestration Loop

**Duration**: 3 days

**Learning Outcomes**:
- Understand agentic loops
- Implement `while(true)` pattern
- Handle termination conditions

**Deliverables**:
```
src/
├── agent/
│   ├── executor.ts        (Main orchestration loop)
│   └── types.ts           (AgentDefinition interface)
└── tools/
    └── complete-task.ts   (Special termination tool)

docs/adrs/
├── 004-orchestration-loop.md
└── 005-termination-strategy.md
```

**ADR: Why `while(true)` Instead of Recursion?**

**Context**: Need to handle multi-turn agent execution

**Alternatives Considered**:
1. **Recursion**: `async function turn() { if (!done) await turn(); }`
2. **Fixed iterations**: `for (let i = 0; i < MAX_TURNS; i++)`
3. **While loop**: `while (true) { if (done) break; }`

**Decision**: While loop with explicit break conditions

**Rationale**:
- **Recursion**: Stack overflow risk on long conversations
- **Fixed iterations**: Arbitrary limit, no early exit
- **While loop**: Clear termination logic, no stack limit

**Gemini CLI Reference**: `/home/user/gemini-cli/packages/core/src/agents/executor.ts:397-434`

**Real Gemini CLI Code**:
```typescript
async run(inputs: AgentInputs, signal: AbortSignal): Promise<OutputObject> {
  let turnCounter = 0;
  const chat = await this.createChatObject(inputs);
  const tools = this.prepareToolsList();

  while (true) {
    // Check termination conditions
    const reason = this.checkTermination(startTime, turnCounter);
    if (reason) {
      terminateReason = reason;
      break;
    }

    // Execute single turn
    const turnResult = await this.executeTurn(
      chat, currentMessage, tools, turnCounter++, signal
    );

    // Check if agent called complete_task
    if (turnResult.status === 'stop') {
      terminateReason = turnResult.terminateReason;
      break;
    }

    currentMessage = turnResult.nextMessage;
  }

  return { result: finalResult, terminate_reason: terminateReason };
}
```

**Mini Implementation (~150 lines)**:
```typescript
// src/agent/types.ts
export enum TerminateReason {
  GOAL = 'GOAL',              // Model called complete_task
  TIMEOUT = 'TIMEOUT',        // Exceeded max time
  MAX_TURNS = 'MAX_TURNS',    // Exceeded turn limit
  ERROR = 'ERROR',            // Unrecoverable error
}

export interface AgentConfig {
  maxTurns: number;
  maxTimeMinutes: number;
  tools: BaseTool[];
}

// src/agent/executor.ts
import { GeminiClient } from '../client.js';
import { ToolRegistry } from '../registry.js';
import type { AgentConfig, TerminateReason } from './types.js';

export class AgentExecutor {
  constructor(
    private client: GeminiClient,
    private registry: ToolRegistry,
    private config: AgentConfig,
  ) {}

  async run(query: string): Promise<{ result: string; reason: TerminateReason }> {
    const startTime = Date.now();
    let turnCounter = 0;
    let currentMessage = query;
    let finalResult = '';

    while (true) {
      // Termination checks
      if (turnCounter >= this.config.maxTurns) {
        return { result: finalResult, reason: TerminateReason.MAX_TURNS };
      }

      const elapsedMinutes = (Date.now() - startTime) / 60000;
      if (elapsedMinutes > this.config.maxTimeMinutes) {
        return { result: finalResult, reason: TerminateReason.TIMEOUT };
      }

      // Execute turn
      try {
        const response = await this.client.sendMessage(currentMessage);

        // Check for function calls
        const functionCalls = response.functionCalls ?? [];

        if (functionCalls.length === 0) {
          // No tools requested, just text response
          finalResult = response.text;
          continue;
        }

        // Execute each tool
        const toolResults = [];
        for (const fnCall of functionCalls) {
          // Special case: complete_task
          if (fnCall.name === 'complete_task') {
            finalResult = fnCall.args.result as string;
            return { result: finalResult, reason: TerminateReason.GOAL };
          }

          // Regular tool execution
          const tool = this.registry.get(fnCall.name);
          const validationError = tool.validate(fnCall.args);

          if (validationError) {
            toolResults.push({
              callId: fnCall.id,
              error: validationError,
            });
            continue;
          }

          const result = await tool.execute(fnCall.args);
          toolResults.push({
            callId: fnCall.id,
            result: result.output,
          });
        }

        // Send tool results back as next message
        currentMessage = this.formatToolResults(toolResults);
        turnCounter++;

      } catch (error) {
        return {
          result: error instanceof Error ? error.message : String(error),
          reason: TerminateReason.ERROR,
        };
      }
    }
  }

  private formatToolResults(results: Array<{ callId: string; result?: string; error?: string }>): string {
    return results
      .map(r => `[${r.callId}]: ${r.error ?? r.result}`)
      .join('\n');
  }
}
```

**Checkpoint Quiz**:
1. Why check termination conditions at the START of each iteration?
2. What happens if the model never calls `complete_task`?
3. How would you add a "user cancellation" termination reason?

**Learning Exercise**:
Add a `LOOP_DETECTED` termination reason that triggers if the model calls the same tool with the same arguments 3 times in a row.

<details>
<summary>Solution (click to expand)</summary>

```typescript
// Add to executor.ts
private callHistory: Array<{ name: string; args: string }> = [];

// In the tool execution loop:
const callSignature = `${fnCall.name}:${JSON.stringify(fnCall.args)}`;
this.callHistory.push({ name: fnCall.name, args: JSON.stringify(fnCall.args) });

// Check for loops
if (this.callHistory.length >= 3) {
  const last3 = this.callHistory.slice(-3);
  if (last3.every(c => c.name === last3[0].name && c.args === last3[0].args)) {
    return { result: 'Loop detected', reason: TerminateReason.LOOP_DETECTED };
  }
}
```
</details>

---

### Phase 3: Turn Management & Streaming

**Duration**: 2 days

**Learning Outcomes**:
- Understand async generators
- Handle streaming responses
- Yield events for UI updates

**Deliverables**:
```
src/
├── agent/
│   ├── executor.ts        (Modified to use Turn)
│   └── turn.ts            (New: Single turn abstraction)
└── events.ts              (Event type definitions)

docs/adrs/
└── 006-turn-abstraction.md
```

**ADR: Why Extract Turn as Separate Class?**

**Context**: `executor.ts` was handling both orchestration AND API calls

**Decision**: Extract turn management into `Turn` class

**Rationale**:
- **Separation of Concerns**: Executor = multi-turn logic, Turn = single API call
- **Streaming**: Turn can yield events (loading, content chunks, citations)
- **Testing**: Can test turn logic independently

**Gemini CLI Reference**: `/home/user/gemini-cli/packages/core/src/core/turn.ts:218-362`

**Real Gemini CLI Turn Architecture**:
```typescript
// turn.ts
export class Turn {
  async *run(
    model: string,
    req: PartListUnion,
    signal: AbortSignal,
  ): AsyncGenerator<ServerGeminiStreamEvent> {
    const responseStream = await this.chat.sendMessageStream(model, req);

    for await (const streamEvent of responseStream) {
      if (streamEvent.type === 'retry') {
        yield { type: GeminiEventType.Retry };
        continue;
      }

      const resp = streamEvent.value;

      // Stream text chunks
      const text = getResponseText(resp);
      if (text) {
        yield { type: GeminiEventType.Content, value: text };
      }

      // Handle function calls
      const functionCalls = resp.functionCalls ?? [];
      for (const fnCall of functionCalls) {
        yield { type: GeminiEventType.ToolCallRequest, value: fnCall };
      }

      // Check if done
      const finishReason = resp.candidates?.[0]?.finishReason;
      if (finishReason) {
        yield { type: GeminiEventType.Finished, value: { reason: finishReason } };
      }
    }
  }
}
```

**Mini Implementation (~100 lines)**:
```typescript
// src/events.ts
export enum EventType {
  Content = 'content',
  ToolCallRequest = 'tool_call_request',
  ToolCallResponse = 'tool_call_response',
  Finished = 'finished',
  Error = 'error',
}

export type StreamEvent =
  | { type: EventType.Content; text: string }
  | { type: EventType.ToolCallRequest; call: FunctionCall }
  | { type: EventType.ToolCallResponse; callId: string; result: string }
  | { type: EventType.Finished }
  | { type: EventType.Error; error: string };

// src/agent/turn.ts
import type { GeminiClient } from '../client.js';
import type { StreamEvent } from '../events.js';
import { EventType } from '../events.js';

export class Turn {
  constructor(private client: GeminiClient) {}

  async *run(message: string): AsyncGenerator<StreamEvent> {
    try {
      // Note: This is simplified - real impl uses sendMessageStream
      const response = await this.client.sendMessage(message);

      // Yield text content
      if (response.text) {
        yield { type: EventType.Content, text: response.text };
      }

      // Yield function calls
      for (const fnCall of response.functionCalls ?? []) {
        yield { type: EventType.ToolCallRequest, call: fnCall };
      }

      yield { type: EventType.Finished };

    } catch (error) {
      yield {
        type: EventType.Error,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
```

**Modified Executor**:
```typescript
// src/agent/executor.ts (using Turn)
import { Turn } from './turn.js';
import { EventType } from '../events.js';

export class AgentExecutor {
  async run(query: string): Promise<{ result: string; reason: TerminateReason }> {
    let currentMessage = query;
    let turnCounter = 0;

    while (true) {
      // Termination checks...

      const turn = new Turn(this.client);
      const pendingToolCalls = [];

      // Process turn events
      for await (const event of turn.run(currentMessage)) {
        switch (event.type) {
          case EventType.Content:
            console.log(event.text); // Display to user
            break;

          case EventType.ToolCallRequest:
            pendingToolCalls.push(event.call);
            break;

          case EventType.Finished:
            // Process tool calls
            if (pendingToolCalls.length === 0) {
              continue; // No tools, next turn
            }

            const toolResults = await this.executeTools(pendingToolCalls);
            currentMessage = this.formatToolResults(toolResults);
            break;
        }
      }

      turnCounter++;
    }
  }
}
```

**Checkpoint Quiz**:
1. What is an async generator and how does `yield` work?
2. Why use events instead of returning an object?
3. How would you add a progress indicator for long-running tools?

---

### Phase 4: React/Ink Terminal UI

**Duration**: 3 days

**Learning Outcomes**:
- Understand React for CLIs
- Handle terminal rendering
- Display streaming content

**Deliverables**:
```
src/
├── ui/
│   ├── App.tsx            (Main UI component)
│   ├── components/
│   │   ├── Message.tsx
│   │   ├── ToolDisplay.tsx
│   │   └── InputPrompt.tsx
│   └── hooks/
│       └── useAgent.ts    (Connect UI to executor)
└── index.tsx              (Entry point with Ink render)

docs/adrs/
└── 007-terminal-ui.md
```

**ADR: Why React/Ink for Terminal UI?**

**Context**: Need interactive terminal interface with real-time updates

**Alternatives Considered**:
1. **console.log**: Simple but no real-time updates
2. **blessed/blessed-contrib**: Powerful but complex API
3. **React/Ink**: React paradigm in terminal

**Decision**: React/Ink

**Rationale**:
- Familiar React patterns (components, hooks, state)
- Automatic re-rendering on state changes
- Clean separation of UI and logic

**Gemini CLI Reference**: `/home/user/gemini-cli/packages/cli/src/ui/App.tsx:1-90`

**Mini Implementation (~200 lines)**:
```typescript
// src/ui/App.tsx
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { AgentExecutor } from '../agent/executor.js';
import type { StreamEvent } from '../events.js';
import { EventType } from '../events.js';

interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

export function App({ executor }: { executor: AgentExecutor }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const handleSubmit = async (query: string) => {
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setIsRunning(true);

    let currentContent = '';

    // Run agent and process events
    const turn = new Turn(executor.client);
    for await (const event of turn.run(query)) {
      switch (event.type) {
        case EventType.Content:
          currentContent += event.text;
          setMessages(prev => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: currentContent },
          ]);
          break;

        case EventType.ToolCallRequest:
          setMessages(prev => [
            ...prev,
            { role: 'tool', content: `Calling ${event.call.name}...` },
          ]);
          break;
      }
    }

    setIsRunning(false);
  };

  useInput((input, key) => {
    if (key.return && !isRunning) {
      handleSubmit(input);
      setInput('');
    } else if (!isRunning) {
      setInput(prev => prev + input);
    }
  });

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box borderStyle="single" borderColor="cyan">
        <Text bold color="cyan"> Mini Gemini CLI </Text>
      </Box>

      {/* Messages */}
      <Box flexDirection="column" marginTop={1}>
        {messages.map((msg, i) => (
          <Box key={i} marginBottom={1}>
            <Text color={msg.role === 'user' ? 'green' : 'blue'}>
              {msg.role}: {msg.content}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Input */}
      {!isRunning && (
        <Box>
          <Text color="gray">&gt; {input}</Text>
        </Box>
      )}
    </Box>
  );
}
```

**Compare to Real**:
| Feature | Mini | Real Gemini CLI |
|---------|------|-----------------|
| Components | 3 | 13+ components |
| Markdown Rendering | No | Yes (syntax highlighting) |
| Diff Display | No | Yes (colored diffs) |
| Loading Indicators | No | Yes (spinners, progress) |
| History Navigation | No | Yes (up/down arrows) |

---

### Phase 5: Policy Engine

**Duration**: 2 days

**Learning Outcomes**:
- Implement security controls
- Handle user confirmations
- Priority-based rule evaluation

**Deliverables**:
```
src/
├── policy/
│   ├── engine.ts          (Policy evaluation)
│   ├── rules.ts           (Rule definitions)
│   └── config.ts          (TOML parsing)
└── tools/
    └── base-tool.ts       (Modified to integrate policy)

docs/adrs/
└── 008-policy-engine.md
```

**ADR: Why Policy Engine?**

**Context**: Tools can be destructive (write-file, terminal)

**Decision**: Require user approval for high-risk operations

**Gemini CLI Reference**: `/home/user/gemini-cli/packages/core/src/policy/engine.ts`

**Mini Implementation** (~100 lines - details in Phase 5 checkpoint)

---

### Phase 6: MCP Integration

**Duration**: 3 days

**Learning Outcomes**:
- Understand Model Context Protocol
- Integrate external tools
- Handle protocol versioning

**Deliverables** (details in Phase 6 checkpoint)

---

## ADR Template

Every architectural decision should be documented using this template:

```markdown
# ADR-XXX: [Title]

## Context

[What problem are we solving? What constraints exist?]

## Decision

[What approach did we choose?]

## Alternatives Considered

1. **Option A**: [Description]
   - Pros: [...]
   - Cons: [...]

2. **Option B**: [Description]
   - Pros: [...]
   - Cons: [...]

## Rationale

[Why did we choose this decision over alternatives?]

## Gemini CLI Reference

- **File**: `/home/user/gemini-cli/packages/.../file.ts`
- **Lines**: X-Y
- **Commit**: abc123 (Date)
- **Key snippet**:
  ```typescript
  // Relevant code from real implementation
  ```

## Historical Context

[When was this introduced in real Gemini CLI? What problem did it solve?]

## Trade-offs

### Benefits
- [What we gain]

### Limitations
- [What we lose or compromise]

## Learning Outcomes

After implementing this decision, you should understand:
1. [Concept 1]
2. [Concept 2]
3. [Concept 3]

## Future Considerations

[How might this decision evolve? What are follow-up questions?]
```

---

## Comparative Analysis

### Code Complexity

| Phase | Mini LOC | Real Gemini CLI LOC | Ratio |
|-------|----------|---------------------|-------|
| Phase 0 (Client) | 100 | 383 (GeminiClient.ts) | 1:4 |
| Phase 1 (Tools) | 200 | 296 (read-file.ts) | 1:1.5 |
| Phase 2 (Executor) | 150 | 500+ (executor.ts) | 1:3+ |
| Phase 3 (Turn) | 100 | 250 (turn.ts) | 1:2.5 |
| Phase 4 (UI) | 200 | 1000+ (all UI) | 1:5 |
| **Total** | **~750** | **~8000+** | **1:10** |

### Feature Coverage

```
Mini Features                Real Gemini CLI Features
─────────────────           ──────────────────────────
✓ Basic API calls           ✓ API calls
✓ Tool execution            ✓ Tool execution
✓ Orchestration loop        ✓ Orchestration loop
✗ Error recovery            ✓ Retry logic, error reporting
✗ Context compression       ✓ Auto-compression when near limit
✗ Subagents                 ✓ Recursive agent composition
✗ MCP                       ✓ Full MCP support
✗ Policy engine             ✓ TOML-based policies
✗ Telemetry                 ✓ Usage tracking, analytics
```

---

## Learning Checkpoints

### Checkpoint 1: TypeScript Fundamentals
**After Phase 0**

**Quiz**:
1. Explain type erasure with an example
2. What is `verbatimModuleSyntax` and why does Gemini CLI use it?
3. What's the difference between `type` and `interface`?

**Coding Exercise**:
Write a function that:
- Takes a `Content` object from @google/genai
- Extracts all text from all parts
- Returns a single string
- Has proper TypeScript types

<details>
<summary>Solution</summary>

```typescript
import type { Content } from '@google/genai';

function extractText(content: Content): string {
  return content.parts
    .filter(part => 'text' in part)
    .map(part => part.text)
    .join('');
}
```
</details>

---

### Checkpoint 2: Declarative Tools
**After Phase 1**

**Quiz**:
1. Why use Zod when we already have TypeScript types?
2. What happens if you call `execute()` without calling `validate()` first?
3. How would you test the `validate()` method in isolation?

**Coding Exercise**:
Implement a `WriteFileTool` that:
- Validates `file_path` is absolute
- Validates `content` is provided
- Writes to file system
- Returns success/error

**Compare your implementation to**: `/home/user/gemini-cli/packages/core/src/tools/write-file.ts`

---

### Checkpoint 3: Orchestration Loop
**After Phase 2**

**Quiz**:
1. What are all possible termination reasons?
2. Why check termination at the start vs. end of the loop?
3. How would you add a "user cancellation" feature?

**Coding Exercise**:
Add telemetry to the executor:
- Track total turns executed
- Track tools called (with counts)
- Track time per turn
- Export as JSON

---

## Development Tools

### Tool 1: Execution Visualizer

**Purpose**: Visualize agent execution flow

**Implementation**:
```typescript
// tools/visualizer.ts
import type { StreamEvent } from '../src/events.js';

export class ExecutionVisualizer {
  private timeline: Array<{ time: number; event: StreamEvent }> = [];

  record(event: StreamEvent) {
    this.timeline.push({ time: Date.now(), event });
  }

  render() {
    console.log('┌─ Execution Timeline ─┐');
    for (const { time, event } of this.timeline) {
      console.log(`├─ ${new Date(time).toISOString()}`);
      console.log(`│  ${event.type}: ${JSON.stringify(event)}`);
    }
    console.log('└───────────────────────┘');
  }

  exportMermaid(): string {
    return `
sequenceDiagram
${this.timeline.map((e, i) => {
  if (e.event.type === 'tool_call_request') {
    return `  Agent->>Tool: ${e.event.call.name}`;
  } else if (e.event.type === 'tool_call_response') {
    return `  Tool->>Agent: result`;
  }
  return '';
}).join('\n')}
    `;
  }
}
```

**Usage**:
```typescript
const visualizer = new ExecutionVisualizer();
for await (const event of turn.run(query)) {
  visualizer.record(event);
}
visualizer.render();
```

**Output**:
```
┌─ Execution Timeline ─┐
├─ 2025-04-15T10:30:00.000Z
│  content: "Let me read the file..."
├─ 2025-04-15T10:30:01.234Z
│  tool_call_request: {"name":"read_file","args":{"file_path":"/foo"}}
├─ 2025-04-15T10:30:02.456Z
│  tool_call_response: {"callId":"abc","result":"file contents"}
└───────────────────────┘
```

---

### Tool 2: Turn Debugger

**Purpose**: Step through agent execution

**Implementation** (pseudo-code):
```typescript
// tools/debugger.ts
export class TurnDebugger {
  async runWithBreakpoints(executor: AgentExecutor, query: string) {
    // Set breakpoints on tool calls
    executor.on('tool_call', async (call) => {
      console.log(`\nBreakpoint: About to call ${call.name}`);
      console.log('Arguments:', call.args);
      await waitForKeypress();
    });

    return executor.run(query);
  }
}
```

---

### Tool 3: Diff Viewer

**Purpose**: Compare Mini vs. Real implementations

**Implementation**:
```bash
# tools/compare.sh
#!/bin/bash

echo "=== Comparing Read File Tool ==="
echo ""
echo "Mini implementation:"
wc -l mini-gemini-cli/src/tools/read-file.ts
echo ""
echo "Real implementation:"
wc -l gemini-cli/packages/core/src/tools/read-file.ts
echo ""
diff -y --width=150 \
  mini-gemini-cli/src/tools/read-file.ts \
  gemini-cli/packages/core/src/tools/read-file.ts
```

---

## Next Steps

1. **Start with Phase 0**: Set up TypeScript project and make first API call
2. **Document as you go**: Write ADRs for each decision
3. **Compare regularly**: Check your implementation against real Gemini CLI
4. **Build iteratively**: Each phase should produce working code
5. **Test understanding**: Complete checkpoint quizzes before moving on

---

## Additional Resources

- [Gemini API Docs](https://ai.google.dev/gemini-api/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Ink Documentation](https://github.com/vadimdemedes/ink)
- [Zod Documentation](https://zod.dev/)
- [Model Context Protocol](https://modelcontextprotocol.io/)

---

## Appendix: Full File Tree

**Real Gemini CLI** (as of version 0.15.0):
```
gemini-cli/
├── packages/
│   ├── cli/                    # Frontend (UI, input handling)
│   │   ├── src/
│   │   │   ├── ui/
│   │   │   │   ├── App.tsx
│   │   │   │   ├── components/ (13+ components)
│   │   │   │   └── hooks/
│   │   │   └── index.tsx
│   │   └── package.json
│   ├── core/                   # Backend (API, tools, agents)
│   │   ├── src/
│   │   │   ├── agents/
│   │   │   │   ├── executor.ts
│   │   │   │   └── types.ts
│   │   │   ├── core/
│   │   │   │   ├── geminiChat.ts
│   │   │   │   ├── turn.ts
│   │   │   │   └── prompts.ts
│   │   │   ├── tools/
│   │   │   │   ├── read-file.ts
│   │   │   │   ├── write-file.ts
│   │   │   │   ├── edit.ts
│   │   │   │   ├── grep.ts
│   │   │   │   ├── glob.ts
│   │   │   │   ├── ls.ts
│   │   │   │   └── terminal.ts
│   │   │   ├── policy/
│   │   │   │   └── engine.ts
│   │   │   └── utils/
│   │   └── package.json
│   ├── mcp-client/             # MCP integration
│   ├── google-auth/            # OAuth support
│   └── test-utils/             # Testing utilities
├── tsconfig.json
└── package.json
```

**Mini Gemini CLI** (what you'll build):
```
mini-gemini-cli/
├── src/
│   ├── client.ts               # Phase 0
│   ├── tools/
│   │   ├── base-tool.ts        # Phase 1
│   │   ├── read-file.ts        # Phase 1
│   │   └── write-file.ts       # Phase 1
│   ├── registry.ts             # Phase 1
│   ├── agent/
│   │   ├── types.ts            # Phase 2
│   │   ├── executor.ts         # Phase 2
│   │   └── turn.ts             # Phase 3
│   ├── events.ts               # Phase 3
│   ├── ui/
│   │   ├── App.tsx             # Phase 4
│   │   └── components/         # Phase 4
│   ├── policy/
│   │   └── engine.ts           # Phase 5
│   └── index.ts
├── docs/
│   ├── adrs/
│   │   ├── 001-typescript-setup.md
│   │   ├── 002-function-calling.md
│   │   ├── 003-declarative-tools.md
│   │   ├── 004-orchestration-loop.md
│   │   ├── 005-termination-strategy.md
│   │   ├── 006-turn-abstraction.md
│   │   ├── 007-terminal-ui.md
│   │   └── 008-policy-engine.md
│   └── comparisons/
│       ├── phase0-vs-real.md
│       ├── phase1-vs-real.md
│       └── ...
├── tools/
│   ├── visualizer.ts
│   ├── debugger.ts
│   └── compare.sh
├── tsconfig.json
└── package.json
```

---

**End of Learning Framework**

*This document will evolve as you progress through phases. Treat it as a living guide, adding your own observations and insights as you build.*
