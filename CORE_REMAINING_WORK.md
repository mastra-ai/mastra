# Circular Dependency Analysis Summary

## Current State

After initial fixes, we reduced circular dependencies from **20 to 12 cycles**. The remaining 12 cycles are tightly coupled and require architectural changes to resolve.

### Remaining Cycles Overview

| Cycle # | Path                                                                                                                       | Root Cause                                                               |
| ------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| #1-5    | `workflows/index.ts` → `workflow.ts` → `agent.ts` → `model.loop.ts` → `loop/index.ts` → `agentic-loop` → back to workflows | Deep integration between workflow and agent execution                    |
| #6-7    | `agent.ts` ↔ `loop/network/index.ts`                                                                                      | Bidirectional dependency - agent uses networkLoop, network creates Agent |
| #8-12   | `workflow.ts` → `agent.ts` → `prepare-stream/*` → back to workflow                                                         | Workflow's createStep needs Agent class for instanceof check             |
| #9      | `agent.ts` → `prepare-stream` → `structured-output.ts` → `agent.ts`                                                        | StructuredOutputProcessor creates internal Agent                         |

## Subpaths with Circular Dependencies

| Subpath                      | Has Circular Deps |
| ---------------------------- | ----------------- |
| `agent/index.ts`             | Yes               |
| `evals/index.ts`             | Yes               |
| `evals/scoreTraces/index.ts` | Yes               |
| `loop/index.ts`              | Yes               |
| `mastra/index.ts`            | Yes               |
| `processors/index.ts`        | Yes               |
| `relevance/index.ts`         | Yes               |
| `workflows/index.ts`         | Yes               |

## Subpaths without Circular Dependencies

- `a2a/index.ts`
- `action/index.ts`
- `bundler/index.ts`
- `cache/index.ts`
- `deployer/index.ts`
- `di/index.ts`
- `error/index.ts`
- `events/index.ts`
- `features/index.ts`
- `hooks/index.ts`
- `integration/index.ts`
- `llm/index.ts`
- `logger/index.ts`
- `mcp/index.ts`
- `memory/index.ts`
- `observability/index.ts`
- `request-context/index.ts`
- `server/index.ts`
- `storage/index.ts`
- `stream/index.ts`
- `tools/index.ts`
- `tts/index.ts`
- `types/index.ts`
- `vector/index.ts`
- `voice/index.ts`

## All Circular Dependency Patterns

### 1. workflows ↔ agent ↔ loop (main cycle)

```
workflows/index.ts → workflow.ts → agent/agent.ts → llm/model/model.loop.ts → loop/index.ts → loop.ts → loop/workflows/stream.ts → agentic-loop/index.ts → (back to workflows)
```

### 2. agent ↔ loop/network cycle

```
agent/agent.ts → loop/network/index.ts → (back to agent)
```

### 3. agent ↔ prepare-stream ↔ structured-output cycle

```
agent/agent.ts → agent/workflows/prepare-stream/index.ts → map-results-step.ts → processors/processors/structured-output.ts → (back to agent)
```

### 4. workflow → agent → prepare-stream sub-cycles (extensions of #3)

- `workflow.ts → agent.ts → prepare-stream/index.ts → prepare-memory-step.ts → (back to workflow)`
- `workflow.ts → agent.ts → prepare-stream/index.ts → prepare-tools-step.ts → (back to workflow)`
- `workflow.ts → agent.ts → prepare-stream/index.ts → stream-step.ts → (back to workflow)`

### 5. agentic-execution sub-cycles (extensions of #1)

- `...agentic-loop/index.ts → agentic-execution/index.ts → (back to workflows)`
- `...agentic-execution/index.ts → llm-execution-step.ts → (back to workflows)`
- `...agentic-execution/index.ts → llm-mapping-step.ts → (back to workflows)`
- `...agentic-execution/index.ts → tool-call-step.ts → (back to workflows)`

## Root Causes (3 to fix)

| #   | Root Cycle                 | Files Involved                                                  |
| --- | -------------------------- | --------------------------------------------------------------- |
| 1   | workflows ↔ loop          | `agentic-loop/index.ts` imports from `workflows/index.ts`       |
| 2   | agent ↔ loop/network      | `loop/network/index.ts` imports from `agent/agent.ts`           |
| 3   | agent ↔ structured-output | `processors/structured-output.ts` imports from `agent/agent.ts` |

Fixing these 3 root causes should resolve all 12 reported circular dependencies.

### Key Finding: Execution-Time Dependencies

**None of these cycles cause runtime issues today** because all circular imports are used at **execution time** (inside function bodies), not at **module load time**. JavaScript handles these deferred usages correctly.

| File                    | Import                        | Usage              | When Used                  |
| ----------------------- | ----------------------------- | ------------------ | -------------------------- |
| `agent.ts`              | `networkLoop`                 | Function call      | Line 2754 (inside method)  |
| `agent.ts`              | `createPrepareStreamWorkflow` | Function call      | Line 2517 (inside method)  |
| `loop/network/index.ts` | `Agent` class                 | `new Agent({...})` | Line 72 (inside function)  |
| `structured-output.ts`  | `Agent` class                 | `new Agent({...})` | Constructor (line 61)      |
| `workflow.ts`           | `Agent` class                 | `instanceof Agent` | Line 152 (inside function) |

---

## Four Approaches to Fix Remaining Cycles

### Option 1: Dependency Injection

**Concept**: Instead of importing `Agent` directly, consumers receive the Agent class or instance as a parameter.

#### Example

```typescript
// BEFORE
import { Agent } from '../../agent/agent';

export class StructuredOutputProcessor {
  constructor(options: StructuredOutputOptions) {
    this.structuringAgent = new Agent({...});
  }
}

// AFTER
export interface AgentFactory {
  create(config: AgentConfig): AgentLike;
}

export class StructuredOutputProcessor {
  constructor(options: StructuredOutputOptions & { agentFactory: AgentFactory }) {
    this.structuringAgent = options.agentFactory.create({...});
  }
}
```

#### Pros

- Clean separation of concerns
- Excellent testability (easy to inject mocks)
- Flexible - can pass different implementations
- No dynamic imports needed
- Explicit dependencies - clear what each component needs

#### Cons

- **Breaking API change** - consumers must provide the factory/instance
- Boilerplate - every call site needs to pass the dependency
- Propagation - dependency must be passed through entire call chain
- More verbose code

#### Files Affected

- `StructuredOutputProcessor` - needs `agentFactory` in options
- `loop/network/index.ts` - needs Agent class passed to `networkLoop`
- `workflow.ts` - needs Agent class passed to `createStep` (or remove Agent overload)

---

### Option 2: Interface Extraction

**Concept**: Extract the minimal interface needed by each consumer into a shared module with no dependencies.

#### Example

```typescript
// NEW FILE: packages/core/src/agent/agent.interface.ts
// This file has NO imports from other core modules

export interface AgentLike {
  id: string;
  name: string;
  stream(prompt: string, options?: StreamOptions): Promise<ModelOutput>;
  getModel(options?: { requestContext?: RequestContext }): Promise<MastraLanguageModel>;
  getInstructions(options?: { requestContext?: RequestContext }): Promise<string>;
}

export interface AgentConfig {
  id: string;
  name: string;
  instructions: string;
  model: MastraModelConfig;
}
```

```typescript
// structured-output.ts
import type { AgentLike, AgentConfig } from '../../agent/agent.interface';

export class StructuredOutputProcessor {
  private structuringAgent: AgentLike;
  // Uses interface instead of concrete class
}
```

#### Pros

- Type safety maintained
- Minimal code changes - just change import paths
- Decoupling - modules depend on abstractions
- No runtime changes - only affects type checking
- Future-proof - easy to add alternative implementations

#### Cons

- **`instanceof` breaks** - cannot use `instanceof Agent` with interfaces
- Must use duck-typing or type guards for runtime checks
- Interface maintenance burden - must keep in sync with class
- Type duplication - definitions exist in two places

#### Critical Issue with `workflow.ts`

```typescript
// Line 151-152 in workflow.ts - THIS BREAKS
if (params instanceof Agent) {
  // Requires actual Agent class, not interface
}

// Would need to change to duck-typing:
function isAgentLike(params: unknown): params is AgentLike {
  return params !== null && typeof params === 'object' && 'stream' in params && 'id' in params;
}
```

**Note**: The INSTRUCTIONS.md explicitly says "Don't change runtime logic to fix cycles - Avoid replacing `instanceof` checks with property checks". This makes Option 2 problematic for `workflow.ts`.

---

### Option 3: Module Reorganization

**Concept**: Restructure the module hierarchy so shared code lives in lower-level modules that don't create cycles.

#### Proposed Structure

```
packages/core/src/
├── primitives/                    # NEW: Foundation layer, no circular deps
│   ├── agent-core.ts              # Core Agent functionality
│   ├── workflow-core.ts           # Core workflow functions (createWorkflow, createStep)
│   └── types.ts                   # Shared types
├── agent/
│   ├── agent.ts                   # Full Agent extends primitives/agent-core
│   └── ...
├── workflows/
│   ├── workflow.ts                # Re-exports from primitives + Agent-specific overloads
│   └── ...
├── processors/
│   └── structured-output.ts       # Imports from primitives/agent-core
└── loop/
    └── network/
        └── index.ts               # Imports from primitives/agent-core
```

#### Example

```typescript
// NEW: primitives/agent-core.ts
// Contains minimal Agent that processors/network need
export class AgentCore {
  id: string;
  name: string;

  async stream(prompt: string, options?: StreamOptions): Promise<ModelOutput> {
    // Core streaming implementation
  }

  async getModel(): Promise<MastraLanguageModel> {
    // Core model resolution
  }
}

// agent/agent.ts
import { AgentCore } from '../primitives/agent-core';

export class Agent extends AgentCore {
  // Full implementation with all features
  // Memory, tools, voice, etc.
}

// processors/structured-output.ts
import { AgentCore } from '../../primitives/agent-core';

export class StructuredOutputProcessor {
  private structuringAgent: AgentCore;

  constructor(options: StructuredOutputOptions) {
    this.structuringAgent = new AgentCore({...});
  }
}
```

#### Pros

- Clean architecture with clear dependency hierarchy
- No runtime hacks - proper class inheritance
- `instanceof` works - `Agent instanceof AgentCore` is true
- Reusable primitives - other packages can use base classes
- Excellent long-term maintainability
- Clear module boundaries

#### Cons

- **Major refactoring effort** - need to split Agent class (~2700 lines)
- Risk of breaking changes during migration
- Inheritance complexity - base class must be carefully designed
- Testing overhead - need to test both base and full classes
- All imports need updating across codebase

#### Key Challenge

The `Agent` class is ~2700 lines with many interdependent methods. Extracting a meaningful "core" class that:

1. Has no circular dependencies
2. Is still useful for processors/network
3. Can be properly extended by full Agent

...requires careful analysis of method dependencies.

---

### Option 4: Lazy Initialization (Dynamic Imports)

**Concept**: Defer the import of modules until they're actually needed at runtime using `import()`.

#### Example

```typescript
// BEFORE
import { Agent } from '../../agent/agent';

export class StructuredOutputProcessor {
  private structuringAgent: Agent;

  constructor(options: StructuredOutputOptions) {
    this.structuringAgent = new Agent({...});
  }
}

// AFTER
export class StructuredOutputProcessor {
  private structuringAgent: any; // or use interface
  private initialized = false;

  private async ensureInitialized(options: StructuredOutputOptions) {
    if (!this.initialized) {
      const { Agent } = await import('../../agent/agent');
      this.structuringAgent = new Agent({
        id: 'structured-output-structurer',
        model: options.model,
        instructions: options.instructions || this.generateInstructions(),
      });
      this.initialized = true;
    }
  }

  async processOutputStream(args: ProcessArgs): Promise<ChunkType | null> {
    await this.ensureInitialized(this.options);
    // ... rest of implementation
  }
}
```

#### Pros

- Minimal code changes required
- No external API changes
- Breaks static analysis cycles completely
- Can improve startup performance (lazy loading)
- Well-supported pattern in JavaScript/TypeScript

#### Cons

- **Violates INSTRUCTIONS.md** - explicitly states "Don't use dynamic imports as a fix"
- Everything becomes async (viral async)
- TypeScript type inference issues with dynamic imports
- Hidden dependencies - harder to trace import graph
- Runtime errors instead of build-time errors
- Testing complexity - mocking dynamic imports is harder
- Hides the architectural problem rather than solving it

---

## Comparison Matrix

| Criteria                  | Dependency Injection | Interface Extraction | Module Reorganization | Lazy Initialization |
| ------------------------- | :------------------: | :------------------: | :-------------------: | :-----------------: |
| Code changes required     |        Medium        |         Low          |       **High**        |         Low         |
| API breaking changes      |       **Yes**        |     No (mostly)      |          No           |         No          |
| `instanceof` works        |         N/A          |        **No**        |          Yes          |         Yes         |
| Type safety               |         High         |        Medium        |         High          |       Medium        |
| Follows INSTRUCTIONS.md   |         Yes          |   **Partially\***    |          Yes          |       **No**        |
| Testability impact        |       Improved       |       Neutral        |        Neutral        |      Degraded       |
| Long-term maintainability |         Good         |        Medium        |     **Excellent**     |        Poor         |
| Risk level                |        Medium        |         Low          |       **High**        |         Low         |
| Effort estimate           |        Medium        |         Low          |       **High**        |         Low         |

\*Interface Extraction conflicts with "Don't change runtime logic" instruction due to `instanceof` usage in workflow.ts

---

## Recommendations

### For Immediate Progress (Lower Risk)

1. **Interface Extraction** for `structured-output.ts` and `loop/network/index.ts`
   - These create new Agent instances internally
   - Can define `AgentLike` interface without breaking `instanceof` in workflow.ts
   - Fixes cycles #6, #7, #9

2. **Dependency Injection** for specific cases
   - `StructuredOutputProcessor` could accept an optional `agentFactory`
   - Maintains backward compatibility with default factory

### For Long-Term Architecture (Higher Effort)

3. **Module Reorganization** for the `workflow.ts` ↔ `agent.ts` cycle
   - Extract `createStep` base implementation to separate file
   - Keep Agent-specific overload in a file that can import Agent
   - Fixes cycles #8, #10, #11, #12

### Leave As-Is (Acceptable Technical Debt)

4. **Cycles #1-5** (workflows → agent → loop → agentic-loop → workflows)
   - These work correctly at runtime
   - Fixing requires major architectural changes to the execution model
   - Cost/benefit may not justify the effort

---

## Revised Implementation Plan

After further analysis, we've identified a **simpler, incremental approach** that avoids the complexity of full module reorganization while still fixing all cycles. The key insight is that most cycles can be broken by **passing the Agent class as a parameter** to internal functions, which is a lightweight form of dependency injection that doesn't break public APIs.

### Priority Order (Easiest First)

#### Phase 1: Fix Cycles #6-7 (agent ↔ loop/network) - EASY

**Problem**: `loop/network/index.ts` imports `Agent` class directly to create `new Agent({...})` in `getRoutingAgent()`.

**Solution**: Pass the `Agent` class as a parameter.

- `getRoutingAgent()` receives `agent: Agent` already - it can use `agent.constructor` or receive the class explicitly
- `createNetworkLoop()` and `networkLoop()` can accept an `AgentClass` parameter
- The caller (`agent.ts`) already imports `Agent` - no new dependencies needed
- **No public API changes** - these are internal functions

**Files to modify**:

1. `packages/core/src/loop/network/index.ts` - Remove `import { Agent }`, add `AgentClass` parameter
2. `packages/core/src/agent/agent.ts` - Pass `Agent` class when calling `networkLoop`

**Risk**: Low - Internal plumbing only

---

#### Phase 2: Fix Cycle #9 (agent ↔ structured-output) - EASY

**Problem**: `processors/structured-output.ts` imports `Agent` class to create `new Agent({...})` in constructor.

**Solution**: Pass the `Agent` class through the processor options.

- `StructuredOutputProcessor` is created internally by the agent's prepare-stream workflow
- The caller can pass the `Agent` class as part of options
- **No public API changes** - `StructuredOutputProcessor` is internal

**Files to modify**:

1. `packages/core/src/processors/processors/structured-output.ts` - Accept `AgentClass` in options
2. `packages/core/src/agent/workflows/prepare-stream/map-results-step.ts` - Pass `Agent` class when creating processor

**Risk**: Low - Internal plumbing only

---

#### Phase 3: Fix Cycles #1-5 (workflows ↔ loop ↔ agentic-loop) - MEDIUM

**Problem**: `agentic-loop/index.ts` imports `createWorkflow` from `../../../workflows/index.ts`, which re-exports from `workflow.ts`, which imports `Agent`.

**Solution**: Extract workflow primitives to a separate file.

Following INSTRUCTIONS.md "Extract Shared Code" approach:

1. Create `packages/core/src/workflows/workflow.core.ts` with `createWorkflow` and `createStep` (without Agent overload)
2. `agentic-loop/index.ts` imports from `workflow.core.ts` directly
3. `workflow.ts` imports from `workflow.core.ts` and adds the Agent-specific `createStep` overload
4. Public barrel `workflows/index.ts` continues to export everything - no public API change

**Files to modify**:

1. Create `packages/core/src/workflows/workflow.core.ts` - Core workflow functions
2. `packages/core/src/workflows/workflow.ts` - Import from core, add Agent overload
3. `packages/core/src/loop/workflows/agentic-loop/index.ts` - Import from `workflow.core.ts`
4. Similar for `agentic-execution/*.ts` files

**Risk**: Medium - More files involved, but follows established patterns

---

#### Phase 4: Fix Cycles #8, #10-12 (workflow → agent → prepare-stream) - MEDIUM

**Problem**: `workflow.ts` imports `Agent` for `instanceof` check. The prepare-stream files import from `workflows`.

**Analysis**: Once Phase 3 is complete, these cycles may partially resolve. The remaining issue is:

- `workflow.ts` needs `Agent` for the `instanceof Agent` check in `createStep`
- prepare-stream files need `createStep`/`createWorkflow`

**Solution**:

- After Phase 3, prepare-stream files import from `workflow.core.ts` (no Agent dependency)
- `workflow.ts` can still import `Agent` for the overload - this is fine as long as nothing in the loop/agentic-execution path imports from `workflow.ts` directly

**Files to modify**:

1. `packages/core/src/agent/workflows/prepare-stream/*.ts` - Import from `workflow.core.ts`

**Risk**: Medium - Depends on Phase 3 being complete

---

### Summary

| Phase | Cycles Fixed | Difficulty | Public API Impact |
| ----- | ------------ | ---------- | ----------------- |
| 1     | #6, #7       | Easy       | None              |
| 2     | #9           | Easy       | None              |
| 3     | #1-5         | Medium     | None              |
| 4     | #8, #10-12   | Medium     | None              |

**Total**: All 12 cycles fixed with **zero public API changes**.

---

## Next Steps

1. **Start with Phase 1** - Fix cycles #6-7 by passing Agent class to `loop/network/index.ts`
2. **Verify with dpdm** after each phase
3. **Run tests** after each phase to ensure no regressions
4. **Proceed to Phase 2** once Phase 1 is verified
