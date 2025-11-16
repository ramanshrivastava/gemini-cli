# Gemini CLI Learning Documentation

This directory contains a comprehensive learning framework for understanding and reimplementing Gemini CLI from scratch.

## 📚 Documentation Structure

```
docs/
├── README.md                           # You are here
├── adrs/                               # Architecture Decision Records
│   ├── 001-typescript-setup.md        # Phase 0: Project setup
│   ├── 002-function-calling.md        # Phase 1: How function calling works
│   ├── 003-declarative-tools.md       # Phase 1: Tool pattern
│   ├── 004-orchestration-loop.md      # Phase 2: Agent loop
│   ├── 005-termination-strategy.md    # Phase 2: When to stop
│   ├── 006-turn-abstraction.md        # Phase 3: Turn management (✅ Example)
│   ├── 007-terminal-ui.md             # Phase 4: React/Ink UI
│   └── 008-policy-engine.md           # Phase 5: Security
├── comparisons/                        # Mini vs. Real implementations
│   ├── phase0-vs-real.md
│   ├── phase1-tools-comparison.md     # Read File Tool comparison (✅ Example)
│   ├── phase2-vs-real.md
│   ├── phase3-vs-real.md
│   └── ...
└── checkpoints/                        # Learning verification
    ├── checkpoint-01-typescript.md    # After Phase 0
    ├── checkpoint-02-tools.md         # After Phase 1 (✅ Example)
    ├── checkpoint-03-loop.md          # After Phase 2
    └── ...
```

---

## 🎯 How to Use This Framework

### Step 1: Read the Main Framework

Start with [`../LEARNING_FRAMEWORK.md`](../LEARNING_FRAMEWORK.md) to understand:
- The overall architecture
- Historical timeline of Gemini CLI development
- Phase-by-phase implementation plan
- Learning philosophy

### Step 2: Follow the Phases

For each phase:

1. **Read the ADR** for that phase
   - Example: For Phase 1 (Tools), read `adrs/003-declarative-tools.md`
   - Understand the **Context**, **Decision**, and **Rationale**
   - See references to the real Gemini CLI code

2. **Implement the Mini version**
   - Follow the code examples in the ADR
   - Build the simplified version (~50-200 lines per phase)

3. **Complete the Checkpoint**
   - Example: After Phase 1, complete `checkpoints/checkpoint-02-tools.md`
   - Quiz questions verify conceptual understanding
   - Coding exercises verify practical skills

4. **Read the Comparison**
   - Example: `comparisons/phase1-tools-comparison.md`
   - See what your Mini version is missing
   - Understand the trade-offs (simplicity vs. robustness)

### Step 3: Iterate

Don't try to build the "Real" version immediately. Instead:

1. Build Mini version (20% of features)
2. Understand why Real version is more complex
3. Add **one feature at a time** from Real to Mini
4. Test each addition
5. Compare against Real again

---

## 📖 Learning Path

### Phase 0: Foundation (1 day)
**Goal**: Set up TypeScript project, make first Gemini API call

**Read**:
- `adrs/001-typescript-setup.md` (✅ Available)
- Main framework Phase 0 section

**Build**:
- Basic Gemini API client (~100 lines)
- Simple chat loop

**Verify**:
- `checkpoints/checkpoint-01-typescript.md`

---

### Phase 1: Tool Execution (2 days)
**Goal**: Implement function calling and declarative tools

**Read**:
- `adrs/002-function-calling.md` (TODO)
- `adrs/003-declarative-tools.md` (TODO)
- `adrs/006-turn-abstraction.md` (✅ Available as reference)

**Build**:
- `BaseTool` abstract class
- `ReadFileTool` implementation
- `ToolRegistry`
- Integration with Gemini API function calling

**Verify**:
- `checkpoints/checkpoint-02-tools.md` (✅ Available)

**Compare**:
- `comparisons/phase1-tools-comparison.md` (✅ Available)

---

### Phase 2: Orchestration Loop (3 days)
**Goal**: Implement agentic while(true) loop

**Read**:
- `adrs/004-orchestration-loop.md` (TODO)
- `adrs/005-termination-strategy.md` (TODO)

**Build**:
- `AgentExecutor` class
- Multi-turn conversation loop
- Termination conditions (GOAL, TIMEOUT, MAX_TURNS)
- `complete_task` tool

**Verify**:
- `checkpoints/checkpoint-03-loop.md` (TODO)

**Compare**:
- `comparisons/phase2-vs-real.md` (TODO)

---

### Phase 3: Turn Management (2 days)
**Goal**: Extract turn abstraction, implement streaming

**Read**:
- `adrs/006-turn-abstraction.md` (✅ Available)

**Build**:
- `Turn` class with async generator
- Event stream (Content, ToolCall, Finished, Error)
- Integration with Executor

**Verify**:
- `checkpoints/checkpoint-04-turn.md` (TODO)

---

### Phase 4: Terminal UI (3 days)
**Goal**: Build React/Ink interface

**Read**:
- `adrs/007-terminal-ui.md` (TODO)

**Build**:
- React components with Ink
- Message display
- Loading indicators
- Input handling

**Verify**:
- `checkpoints/checkpoint-05-ui.md` (TODO)

---

### Phase 5: Policy Engine (2 days)
**Goal**: Add security and user approval

**Read**:
- `adrs/008-policy-engine.md` (TODO)

**Build**:
- Policy engine
- Tool approval workflow
- TOML configuration (optional)

**Verify**:
- `checkpoints/checkpoint-06-policy.md` (TODO)

---

## 🔍 ADR Index

Architecture Decision Records document **why** decisions were made, not just **what** was implemented.

### Available ADRs

| ADR | Phase | Topic | Status |
|-----|-------|-------|--------|
| 001 | 0 | TypeScript Setup | ✅ Complete |
| 006 | 3 | Turn Abstraction | ✅ Complete |

### Planned ADRs

| ADR | Phase | Topic | Status |
|-----|-------|-------|--------|
| 002 | 1 | Function Calling | 📝 TODO |
| 003 | 1 | Declarative Tools | 📝 TODO |
| 004 | 2 | Orchestration Loop | 📝 TODO |
| 005 | 2 | Termination Strategy | 📝 TODO |
| 007 | 4 | Terminal UI | 📝 TODO |
| 008 | 5 | Policy Engine | 📝 TODO |

---

## 📊 Comparison Index

These documents compare the simplified (Mini) implementation with the production (Real) Gemini CLI code.

### Available Comparisons

| Phase | Topic | Lines (Mini) | Lines (Real) | Status |
|-------|-------|--------------|--------------|--------|
| 1 | Read File Tool | 80 | 296 | ✅ Complete |

### Planned Comparisons

| Phase | Topic | Status |
|-------|-------|--------|
| 0 | API Client | 📝 TODO |
| 2 | Orchestration Loop | 📝 TODO |
| 3 | Turn Management | 📝 TODO |
| 4 | Terminal UI | 📝 TODO |
| 5 | Policy Engine | 📝 TODO |

---

## ✅ Checkpoint Index

Learning checkpoints verify understanding before moving to the next phase.

### Available Checkpoints

| Checkpoint | Phase | Topic | Status |
|------------|-------|-------|--------|
| 02 | 1 | Tool System | ✅ Complete |

### Planned Checkpoints

| Checkpoint | Phase | Topic | Status |
|------------|-------|-------|--------|
| 01 | 0 | TypeScript | 📝 TODO |
| 03 | 2 | Orchestration | 📝 TODO |
| 04 | 3 | Turn & Streaming | 📝 TODO |
| 05 | 4 | Terminal UI | 📝 TODO |
| 06 | 5 | Policy Engine | 📝 TODO |

---

## 🛠️ Development Tools

### Visualizer

Located in `../tools/visualizer.ts` (TODO)

**Purpose**: Visualize agent execution flow

**Usage**:
```typescript
const visualizer = new ExecutionVisualizer();
for await (const event of turn.run(query)) {
  visualizer.record(event);
}
visualizer.render(); // Terminal timeline
visualizer.exportMermaid(); // Sequence diagram
```

### Debugger

Located in `../tools/debugger.ts` (TODO)

**Purpose**: Step through agent execution with breakpoints

**Usage**:
```typescript
const debugger = new TurnDebugger();
await debugger.runWithBreakpoints(executor, query);
// Pauses at each tool call for inspection
```

### Comparison Script

Located in `../tools/compare.sh` (TODO)

**Purpose**: Side-by-side diff of Mini vs. Real

**Usage**:
```bash
./tools/compare.sh read-file
# Shows line-by-line differences
```

---

## 📚 Reference: Real Gemini CLI Code

### Key Files to Study

| File | Purpose | Lines | Complexity |
|------|---------|-------|------------|
| `packages/core/src/agents/executor.ts` | Main orchestration loop | 500+ | High |
| `packages/core/src/core/turn.ts` | Single turn processing | 250 | Medium |
| `packages/core/src/core/geminiChat.ts` | API wrapper | 200 | Medium |
| `packages/core/src/tools/read-file.ts` | Example declarative tool | 296 | Low |
| `packages/core/src/agents/types.ts` | Type definitions | 170 | Low |
| `packages/cli/src/ui/App.tsx` | React/Ink main UI | 90 | Medium |

### Commit History Highlights

| Date | Commit | Event |
|------|--------|-------|
| 2025-04-15 | add233c5 | Initial public commit (7,920 lines!) |
| 2025-04-16 | f10aaf7e | Fix 429 rate limit crash |
| 2025-04-17 | a2807272 | Remove internal Google references |
| 2025-04-18 | 24371a39 | **Extract Turn from GeminiClient** |
| 2025-04-18 | 3fce6cea | **Modularize into CLI/Core packages** |
| 2025-07-01 | - | Public announcement |
| 2025-09 | 794d92a7 | **Introduce Declarative Agent Framework** |
| 2025-11 | bf80263b | **Implement Policy Engine** |

---

## 🎓 Learning Outcomes

After completing this framework, you will understand:

### Technical Skills
- ✅ TypeScript strict mode and type system
- ✅ Gemini API function calling mechanism
- ✅ Declarative tool pattern
- ✅ Agentic orchestration loops
- ✅ Event-driven architecture with async generators
- ✅ React for terminal UIs (Ink)
- ✅ Security patterns (policy engine)
- ✅ Zod runtime validation

### Architectural Patterns
- ✅ Separation of concerns (validation, execution, policy)
- ✅ Invocation abstraction
- ✅ Tool composition
- ✅ Error recovery strategies
- ✅ Streaming vs. buffering
- ✅ State management across turns

### Software Engineering
- ✅ How to refactor large codebases (Turn extraction)
- ✅ When to optimize vs. keep simple
- ✅ How to design extensible systems
- ✅ Trade-offs between simplicity and robustness
- ✅ Reading and understanding production code

---

## 🤝 Contributing

This learning framework is a living document. As you work through it:

1. **Found an error?** Fix the ADR or checkpoint
2. **Missing an ADR?** Write one following the template
3. **Want to add a comparison?** Document Mini vs. Real
4. **Discovered a better way?** Share your insights

### ADR Template

See `../LEARNING_FRAMEWORK.md` for the full ADR template.

**TL;DR**:
- Context (problem)
- Decision (solution)
- Alternatives (what else was considered)
- Rationale (why this way)
- Gemini CLI Reference (file:line)
- Trade-offs (benefits/limitations)
- Learning Outcomes

---

## 🚀 Getting Started

**Ready to begin?**

1. Read [`../LEARNING_FRAMEWORK.md`](../LEARNING_FRAMEWORK.md)
2. Set up your `mini-gemini-cli` project
3. Start with Phase 0: TypeScript setup
4. Follow the ADRs, implement, verify with checkpoints
5. Compare your work with Real Gemini CLI
6. Iterate and improve

**Questions?**
- Check the checkpoints for quiz answers
- Look at the comparisons to see what Real does differently
- Study the referenced Gemini CLI files

---

**Happy Learning! 🎉**

*Remember: The goal isn't to build a production clone. The goal is to understand every design decision by implementing it yourself.*
