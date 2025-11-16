# ADR-006: Turn Abstraction and Separation from GeminiClient

## Context

In the initial architecture, the `GeminiClient` class was responsible for:
1. Making API calls to Gemini
2. Managing conversation history
3. Processing streaming responses
4. Extracting function calls from responses
5. Yielding events to the UI

This led to a 380+ line class with multiple responsibilities, making it:
- Hard to test individual concerns
- Difficult to add new event types
- Unclear where to add retry logic
- Challenging to implement conversation compression

**The Question**: How should we organize the code that talks to the Gemini API?

## Decision

**Extract turn management into a separate `Turn` class**, leaving `GeminiClient` (later renamed `GeminiChat`) to handle only:
- API wrapper around `@google/genai`
- History management
- Retry logic

The `Turn` class handles:
- Single model call (one request → one response)
- Streaming response processing
- Event emission (content chunks, tool calls, citations)
- Finish reason detection

**Relationship**:
```
AgentExecutor
    │
    ├─ manages multiple turns (while loop)
    │
    └─> Turn
         │
         ├─ handles single API call
         │
         └─> GeminiChat
              │
              └─ wraps @google/genai SDK
```

## Alternatives Considered

### 1. Keep Everything in GeminiClient
**Pros:**
- Simpler (one class to understand)
- No coordination needed between classes
- Fewer files

**Cons:**
- Single Responsibility Principle violation
- Hard to test streaming logic independently
- Mixing low-level (API) with high-level (turn logic)

**Why rejected:** 380 lines in one class is a code smell, especially when concerns are clearly separable.

### 2. Turn as a Function (not a class)
**Pros:**
- Simpler (no class boilerplate)
- Easier to test (pure function)

**Cons:**
- Can't maintain state (e.g., `pendingToolCalls`, `debugResponses`)
- Can't use `this` for shared data
- Hard to add methods later (e.g., `getDebugResponses()`)

**Why rejected:** Need stateful tracking of tool calls and debug info across the streaming response.

### 3. Turn as an Async Generator Function
```typescript
async function* executeTurn(chat, message) {
  for await (const chunk of chat.sendMessageStream(message)) {
    yield processChunk(chunk);
  }
}
```

**Pros:**
- Functional style (no OOP)
- Clear data flow

**Cons:**
- Still need somewhere to store `pendingToolCalls`
- Would end up passing closures or context objects
- Less discoverable than class methods

**Why rejected:** Class provides natural place for state. Gemini CLI uses OOP throughout.

## Rationale

### Separation of Concerns

**Before (monolithic GeminiClient)**:
```typescript
// packages/cli/src/core/GeminiClient.ts (383 lines)
class GeminiClient {
  private history: Content[] = [];
  private model: GenerativeModel;

  async sendMessage(text: string) {
    // 1. API call
    const response = await this.model.generateContent(...);

    // 2. History management
    this.history.push(...);

    // 3. Stream processing
    for await (const chunk of response.stream()) {
      // 4. Event emission
      yield { type: 'content', value: chunk.text };

      // 5. Tool call extraction
      if (chunk.functionCalls) {
        yield { type: 'tool_call', ... };
      }
    }
  }
}
```

**After (separated concerns)**:
```typescript
// packages/core/src/core/geminiChat.ts (~200 lines)
class GeminiChat {
  private history: Content[] = [];

  async sendMessageStream(model: string, req: MessageRequest) {
    // Only responsible for API calls and history
    const response = await this.client.generateContent(...);
    this.history.push(req.message);
    return response.stream();
  }

  getHistory(): Content[] {
    return this.history;
  }
}

// packages/core/src/core/turn.ts (~180 lines)
class Turn {
  readonly pendingToolCalls: ToolCallRequestInfo[] = [];

  async *run(
    model: string,
    req: PartListUnion,
    signal: AbortSignal
  ): AsyncGenerator<ServerGeminiStreamEvent> {
    // Only responsible for processing single turn
    const responseStream = await this.chat.sendMessageStream(model, req);

    for await (const streamEvent of responseStream) {
      // Extract text
      const text = getResponseText(streamEvent.value);
      if (text) {
        yield { type: GeminiEventType.Content, value: text };
      }

      // Extract function calls
      const functionCalls = streamEvent.value.functionCalls ?? [];
      for (const fnCall of functionCalls) {
        this.pendingToolCalls.push(...);
        yield { type: GeminiEventType.ToolCallRequest, value: fnCall };
      }

      // Check finish
      if (streamEvent.value.finishReason) {
        yield { type: GeminiEventType.Finished, ... };
      }
    }
  }
}
```

### Benefits of Separation

1. **Testability**: Can test turn logic without mocking the entire API client
   ```typescript
   // Test Turn independently
   const mockChat = {
     sendMessageStream: async () => mockStreamWithToolCall()
   };
   const turn = new Turn(mockChat, 'prompt-123');
   const events = [];
   for await (const event of turn.run('gemini-2.0', message, signal)) {
     events.push(event);
   }
   expect(events[0].type).toBe(GeminiEventType.ToolCallRequest);
   ```

2. **Single Responsibility**:
   - `GeminiChat`: "How do I talk to the API?"
   - `Turn`: "What happens in one conversation turn?"
   - `AgentExecutor`: "How do I manage multiple turns?"

3. **Event Stream Clarity**: Turn is an async generator, making event flow explicit
   ```typescript
   for await (const event of turn.run(model, message, signal)) {
     // Event stream is the interface, not method calls
   }
   ```

4. **State Management**: Each turn has its own state (`pendingToolCalls`), isolated from other turns

## Gemini CLI Reference

**Commit**: 24371a39 (April 18, 2025)
**PR**: #42 - "Take the turn management out of GeminiClient"

**Files Modified**:
- **Before**: `packages/cli/src/core/GeminiClient.ts` (383 lines, all-in-one)
- **After**:
  - `packages/core/src/core/geminiChat.ts` (~200 lines, API wrapper)
  - `packages/core/src/core/turn.ts` (~180 lines, turn processing)

**Key snippet from turn.ts** (`/home/user/gemini-cli/packages/core/src/core/turn.ts:218-362`):
```typescript
export class Turn {
  readonly pendingToolCalls: ToolCallRequestInfo[] = [];
  private debugResponses: GenerateContentResponse[] = [];
  private pendingCitations = new Set<string>();
  finishReason: FinishReason | undefined = undefined;

  constructor(
    private readonly chat: GeminiChat,
    private readonly prompt_id: string,
  ) {}

  async *run(
    model: string,
    req: PartListUnion,
    signal: AbortSignal,
  ): AsyncGenerator<ServerGeminiStreamEvent> {
    try {
      const responseStream = await this.chat.sendMessageStream(
        model,
        { message: req, config: { abortSignal: signal } },
        this.prompt_id,
      );

      for await (const streamEvent of responseStream) {
        if (signal?.aborted) {
          yield { type: GeminiEventType.UserCancelled };
          return;
        }

        // Handle retry events
        if (streamEvent.type === 'retry') {
          yield { type: GeminiEventType.Retry };
          continue;
        }

        const resp = streamEvent.value as GenerateContentResponse;
        if (!resp) continue;

        this.debugResponses.push(resp);

        // Process thought parts
        const thoughtPart = resp.candidates?.[0]?.content?.parts?.[0];
        if (thoughtPart?.thought) {
          const thought = parseThought(thoughtPart.text ?? '');
          yield { type: GeminiEventType.Thought, value: thought };
          continue;
        }

        // Process text content
        const text = getResponseText(resp);
        if (text) {
          yield { type: GeminiEventType.Content, value: text };
        }

        // Process function calls
        const functionCalls = resp.functionCalls ?? [];
        for (const fnCall of functionCalls) {
          const event = this.handlePendingFunctionCall(fnCall);
          if (event) {
            yield event;
          }
        }

        // Collect citations
        for (const citation of getCitations(resp)) {
          this.pendingCitations.add(citation);
        }

        // Check if finished
        const finishReason = resp.candidates?.[0]?.finishReason;
        if (finishReason) {
          // Emit citations before finishing
          if (this.pendingCitations.size > 0) {
            yield {
              type: GeminiEventType.Citation,
              value: `Citations:\n${[...this.pendingCitations].sort().join('\n')}`,
            };
            this.pendingCitations.clear();
          }

          this.finishReason = finishReason;
          yield {
            type: GeminiEventType.Finished,
            value: { reason: finishReason, usageMetadata: resp.usageMetadata },
          };
        }
      }
    } catch (e) {
      if (signal.aborted) {
        yield { type: GeminiEventType.UserCancelled };
        return;
      }

      // Error handling...
      yield { type: GeminiEventType.Error, value: { error: structuredError } };
    }
  }

  private handlePendingFunctionCall(fnCall: FunctionCall): ServerGeminiStreamEvent | null {
    const callId = fnCall.id ?? `${fnCall.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const toolCallRequest: ToolCallRequestInfo = {
      callId,
      name: fnCall.name || 'undefined_tool_name',
      args: (fnCall.args || {}) as Record<string, unknown>,
      isClientInitiated: false,
      prompt_id: this.prompt_id,
    };

    this.pendingToolCalls.push(toolCallRequest);
    return { type: GeminiEventType.ToolCallRequest, value: toolCallRequest };
  }

  getDebugResponses(): GenerateContentResponse[] {
    return this.debugResponses;
  }
}
```

**Notice**:
- Turn is stateful: tracks `pendingToolCalls`, `debugResponses`, `pendingCitations`
- Async generator pattern: yields events as they occur
- Error handling: converts exceptions to error events
- Cancellation support: checks `signal.aborted`

## Historical Context

### Timeline

**April 15, 2025** (add233c5): Initial commit
- GeminiClient was monolithic (383 lines)
- Handled API calls, history, streaming, events
- Located in `packages/cli/src/core/GeminiClient.ts`

**April 18, 2025** (24371a39): Refactor
- PR #42: "Take the turn management out of GeminiClient"
- Created Turn class
- GeminiClient → GeminiChat (renamed for clarity)
- Moved from `packages/cli` to `packages/core`

### Why This Timing?

Looking at commits between April 15-18:
- April 16: Fixed 429 rate limit crash (f10aaf7e)
- April 17: Removed internal references (a2807272)
- **April 18**: Multiple refactoring PRs

**Hypothesis**: After public launch, team had bandwidth to refactor technical debt. The 429 crash likely revealed that error handling was tangled with API logic, motivating the separation.

**Evidence**: Commit message says "take the turn management **out of** GeminiClient" (emphasis added), implying it was previously **inside**.

## Trade-offs

### Benefits
✅ **Testability**: Can test turn processing with mocked chat
✅ **Clarity**: Turn is conceptually distinct from API client
✅ **Extensibility**: Easy to add new event types (Thought, Citation, Retry)
✅ **Debugging**: `getDebugResponses()` provides turn-level introspection
✅ **Isolation**: Each turn's state is isolated (no leakage between turns)

### Limitations
❌ **More Files**: 1 file → 2 files (slightly more navigation)
❌ **Indirection**: Executor → Turn → GeminiChat (instead of Executor → GeminiClient)
❌ **Coordination**: Turn and GeminiChat must agree on interfaces

**Cost Example**:
```typescript
// Before: Direct
const response = await geminiClient.sendMessage(text);

// After: Through Turn
const turn = new Turn(geminiChat, promptId);
for await (const event of turn.run(model, message, signal)) {
  // Handle events
}
```

**Why the cost is worth it**: Events are more flexible than return values. Adding "citations" later required no API changes, just a new event type.

## Learning Outcomes

After understanding this refactoring, you should be able to:

1. **Identify Responsibility Boundaries**
   - Ask: "Does this class have a single, clear purpose?"
   - Example: GeminiClient had TWO purposes (API + turn logic) → split

2. **Use Async Generators for Event Streams**
   ```typescript
   async function* streamEvents() {
     yield { type: 'start' };
     yield { type: 'data', value: 'chunk1' };
     yield { type: 'data', value: 'chunk2' };
     yield { type: 'end' };
   }

   for await (const event of streamEvents()) {
     console.log(event); // { type: 'start' }, { type: 'data', ... }, ...
   }
   ```

3. **Design Event-Driven APIs**
   - Instead of: `const result = await doThing();` (one return value)
   - Use: `for await (const event of doThing()) { ... }` (multiple events over time)

4. **Recognize When to Extract a Class**
   - **Trigger**: Class > 300 lines, or method > 50 lines
   - **Test**: Can you describe the class in one sentence? If not, split it.
   - Example: "GeminiClient talks to the API **and** processes turns" → should be two classes

## Future Considerations

### Potential Evolution

1. **Turn Compression**: If conversation history gets too long, Turn could:
   - Detect approaching token limit
   - Yield `ContextWindowWillOverflow` event
   - Executor responds by compressing history

2. **Turn Batching**: For models that support batch API:
   - Execute multiple turns in parallel
   - Merge results

3. **Turn Replay**: For debugging:
   - Save `debugResponses` to disk
   - Replay turn without calling API
   - Useful for testing UI rendering

### Questions to Revisit

- **Should Turn be reusable across multiple calls?**
  - Current: New Turn instance per call
  - Alternative: Reset state between calls

- **Should Turn handle tool execution?**
  - Current: No, Turn only yields tool call requests
  - Alternative: Turn executes tools, yields results
  - **Why current is better**: Tool execution might require user approval (policy engine)

- **Could Turn be a function instead of a class?**
  - Possible if we pass state as parameters
  - But then we'd need to return `(events, pendingToolCalls, debugResponses)` tuple
  - Class is cleaner for stateful operations

---

## Checkpoint Quiz

**Question 1**: What's the difference between `GeminiChat` and `Turn`?

<details>
<summary>Answer</summary>

- **GeminiChat**: Low-level API wrapper
  - Responsibility: Send request to Gemini API, manage history
  - Lifespan: Entire conversation (maintains history across turns)
  - Returns: Raw stream from `@google/genai`

- **Turn**: High-level turn processor
  - Responsibility: Process one turn (model call → events)
  - Lifespan: Single turn
  - Returns: Async generator of semantic events (content, tool calls, citations)

**Analogy**:
- GeminiChat = HTTP client (knows how to make requests)
- Turn = HTTP handler (knows what to do with responses)
</details>

---

**Question 2**: Why use an async generator instead of returning an array of events?

```typescript
// Option A: Array
async function runTurn(): Promise<Event[]> {
  const events = [];
  const response = await api.call();
  events.push({ type: 'content', value: response.text });
  return events;
}

// Option B: Async generator
async function* runTurn(): AsyncGenerator<Event> {
  const response = await api.call();
  yield { type: 'content', value: response.text };
}
```

<details>
<summary>Answer</summary>

**Async generator (Option B) is better because:**

1. **Streaming**: Events are available as they occur, not all at once
   ```typescript
   for await (const event of runTurn()) {
     console.log(event); // Prints each event immediately
   }
   ```

2. **Memory**: Don't need to buffer all events
   - Array: Must wait for all events, then return
   - Generator: Yield one event at a time

3. **Cancellation**: Can stop mid-stream
   ```typescript
   for await (const event of runTurn()) {
     if (event.type === 'error') {
       break; // Stop processing, don't wait for remaining events
     }
   }
   ```

4. **Backpressure**: Consumer controls pace
   - If UI is slow, generator pauses automatically
   - With array, all events are generated upfront

**Real-world impact**: For a long conversation, streaming events provides immediate feedback. Waiting for all events would feel laggy.
</details>

---

**Question 3**: Why does Turn store `pendingToolCalls` instead of yielding them immediately?

```typescript
// In Turn.run()
for (const fnCall of functionCalls) {
  const event = this.handlePendingFunctionCall(fnCall);
  if (event) {
    yield event; // Why not execute the tool here?
  }
}
```

<details>
<summary>Answer</summary>

**Separation of concerns**:

1. **Turn's job**: Detect that model wants to call a tool, yield event
2. **Executor's job**: Decide whether to allow tool call (policy engine), execute it, send results back

**Why this matters**:
- Some tools need user approval (e.g., `write-file`)
- Policy engine must run BEFORE execution
- Turn doesn't know about policies, only about "model requested this tool"

**Flow**:
```
Turn: "Model wants to call read_file with path=/etc/passwd"
  ↓ (yield ToolCallRequest event)
Executor: "Check with policy engine..."
  ↓
PolicyEngine: "read-file is allowed, proceed"
  ↓
Executor: "Execute tool, get results"
  ↓
Executor: "Send results back as next message"
  ↓ (create new Turn)
Turn: "Process model's response to tool results"
```

If Turn executed tools directly, there'd be no place for policy checks.
</details>

---

## Practical Exercise

**Task**: Implement a simplified Turn class that processes a single response.

**Given**:
```typescript
interface StreamChunk {
  text?: string;
  functionCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  finishReason?: 'STOP' | 'MAX_TOKENS';
}

// Mock API that yields chunks
async function* mockGeminiStream(): AsyncGenerator<StreamChunk> {
  yield { text: 'Let me read that file...' };
  yield { functionCalls: [{ name: 'read_file', args: { path: '/foo.txt' } }] };
  yield { finishReason: 'STOP' };
}
```

**Your Task**: Implement `Turn` that converts these chunks to events:
```typescript
enum EventType {
  Content = 'content',
  ToolCall = 'tool_call',
  Finished = 'finished',
}

type Event =
  | { type: EventType.Content; text: string }
  | { type: EventType.ToolCall; name: string; args: Record<string, unknown> }
  | { type: EventType.Finished };

class Turn {
  async *run(stream: AsyncGenerator<StreamChunk>): AsyncGenerator<Event> {
    // TODO: Implement
  }
}
```

**Expected Output**:
```typescript
const turn = new Turn();
for await (const event of turn.run(mockGeminiStream())) {
  console.log(event);
}

// Should print:
// { type: 'content', text: 'Let me read that file...' }
// { type: 'tool_call', name: 'read_file', args: { path: '/foo.txt' } }
// { type: 'finished' }
```

<details>
<summary>Solution</summary>

```typescript
class Turn {
  async *run(stream: AsyncGenerator<StreamChunk>): AsyncGenerator<Event> {
    for await (const chunk of stream) {
      // Yield text content
      if (chunk.text) {
        yield { type: EventType.Content, text: chunk.text };
      }

      // Yield tool calls
      if (chunk.functionCalls) {
        for (const fnCall of chunk.functionCalls) {
          yield {
            type: EventType.ToolCall,
            name: fnCall.name,
            args: fnCall.args,
          };
        }
      }

      // Yield finish
      if (chunk.finishReason) {
        yield { type: EventType.Finished };
      }
    }
  }
}
```

**Bonus**: Add error handling:
```typescript
async *run(stream: AsyncGenerator<StreamChunk>): AsyncGenerator<Event> {
  try {
    for await (const chunk of stream) {
      // ... same as above
    }
  } catch (error) {
    yield {
      type: EventType.Error,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
```
</details>

---

**End of ADR-006**
