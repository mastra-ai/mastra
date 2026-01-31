# Phase 3: Agent & Workflow Targets - Research

**Researched:** 2026-01-24
**Domain:** Target Execution Integration (Agent.generate, Workflow.run)
**Confidence:** HIGH

## Summary

Researched the existing codebase to understand how to integrate Agent.generate() and Workflow.run() with the dataset execution system. Key discovery: **Phase 2 already implemented the core executor** (`packages/core/src/datasets/run/executor.ts`) with both `executeAgent()` and `executeWorkflow()` functions. This phase is about verification, refinement, and ensuring the implementation matches the CONTEXT.md decisions.

The current implementation correctly:

- Uses `agent.generate()` with `isSupportedLanguageModel()` check for v1/v2 models
- Uses `workflow.createRun({ disableScorers: true }).start({ inputData })` pattern
- Handles all workflow result statuses (success, failed, tripwire, suspended, paused)
- Captures errors as strings for storage
- Stores full agent response object as output

**Primary recommendation:** Phase 3 is primarily a verification and testing phase. The executor implementation exists and follows correct patterns. Focus on: (1) verifying edge cases, (2) adding comprehensive tests, (3) ensuring streaming agents work correctly.

## Standard Stack

### Core

| Library      | Version  | Purpose               | Why Standard          |
| ------------ | -------- | --------------------- | --------------------- |
| @mastra/core | internal | Agent, Workflow types | Already implemented   |
| p-map        | ^7.x     | Concurrent execution  | Already in runDataset |

### Supporting

| Library | Version | Purpose | When to Use              |
| ------- | ------- | ------- | ------------------------ |
| vitest  | ^2.x    | Testing | Verify executor behavior |

### Alternatives Considered

| Instead of          | Could Use          | Tradeoff                                   |
| ------------------- | ------------------ | ------------------------------------------ |
| generate()          | stream()           | generate() is simpler, returns full result |
| createRun().start() | workflow.execute() | createRun() matches Phase 2 pattern        |

**Installation:**

```bash
# No new packages needed - all dependencies exist
```

## Architecture Patterns

### Recommended Project Structure

```
packages/core/src/datasets/run/
├── index.ts              # Main runDataset function (EXISTS)
├── executor.ts           # Target execution (EXISTS - Phase 2)
├── scorer.ts             # Scorer helpers (EXISTS - Phase 2)
├── types.ts              # Type definitions (EXISTS - Phase 2)
└── __tests__/
    └── runDataset.test.ts  # Tests (EXISTS - Phase 2)
```

### Pattern 1: Agent Execution with Model Version Check

**What:** Execute agent, checking for v1 vs v2+ model support
**When to use:** Always for agent targets
**Example:**

```typescript
// Source: packages/core/src/datasets/run/executor.ts (EXISTING)
async function executeAgent(agent: Agent, item: DatasetItem): Promise<ExecutionResult> {
  const model = await agent.getModel();

  const result = isSupportedLanguageModel(model)
    ? await agent.generate(item.input as any, {
        scorers: {},
        returnScorerData: true,
      })
    : await (agent as any).generateLegacy?.(item.input as any, {
        scorers: {},
        returnScorerData: true,
      });

  return {
    output: result, // Full FullOutput object
    error: null,
  };
}
```

### Pattern 2: Workflow Execution with Status Handling

**What:** Execute workflow and handle all possible result statuses
**When to use:** Always for workflow targets
**Example:**

```typescript
// Source: packages/core/src/datasets/run/executor.ts (EXISTING)
async function executeWorkflow(workflow: Workflow, item: DatasetItem): Promise<ExecutionResult> {
  const run = await workflow.createRun({ disableScorers: true });
  const result = await run.start({
    inputData: item.input,
  });

  if (result.status === 'success') {
    return { output: result.result, error: null };
  }

  // Handle non-success statuses...
  if (result.status === 'failed') {
    return { output: null, error: result.error?.message ?? 'Workflow failed' };
  }
  // ... etc
}
```

### Pattern 3: Input Pass-Through

**What:** Pass item.input directly to target without transformation
**When to use:** Per CONTEXT.md decision - no input mapping
**Example:**

```typescript
// Agent: item.input passed as messages parameter
await agent.generate(item.input as any, options);

// Workflow: item.input passed as inputData (triggerData)
await run.start({ inputData: item.input });
```

### Pattern 4: Full Output Storage

**What:** Store complete response object, not just text
**When to use:** Agent outputs - captures usage, toolCalls, etc.
**Example:**

```typescript
// FullOutput type from packages/core/src/stream/base/output.ts
interface AgentOutput {
  text: string;
  usage: LanguageModelUsage;
  steps: LLMStepResult[];
  finishReason: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  // ... more fields
}

// Stored as output in ExecutionResult
return { output: fullOutput, error: null };
```

### Anti-Patterns to Avoid

- **Input Transformation:** Don't modify item.input - pass through as-is, let target handle
- **Partial Output:** Don't extract just `text` from agent - store full object
- **Ignoring Non-Success Status:** Handle suspended, paused, tripwire explicitly
- **Swallowing Errors:** Always capture error message, even if output is null

## Don't Hand-Roll

| Problem                 | Don't Build      | Use Instead                  | Why                              |
| ----------------------- | ---------------- | ---------------------------- | -------------------------------- |
| Model version detection | Custom checks    | `isSupportedLanguageModel()` | Already handles v1/v2/v3         |
| Workflow run creation   | Direct execute() | `createRun().start()`        | Proper run lifecycle             |
| Error serialization     | Manual JSON      | `error.message`              | Consistent with existing pattern |

**Key insight:** The executor is already implemented. Don't rebuild - verify and test.

## Common Pitfalls

### Pitfall 1: Streaming Agent Output Not Collected

**What goes wrong:** Stream returned but not consumed, output is incomplete
**Why it happens:** Using stream() instead of generate()
**How to avoid:** Use generate() which returns complete FullOutput
**Warning signs:** Output missing text, usage, or tool results

### Pitfall 2: Workflow Input Mismatch

**What goes wrong:** Workflow throws validation error on input
**Why it happens:** item.input doesn't match workflow.inputSchema
**How to avoid:** Per CONTEXT.md - runtime error is expected, capture as item error
**Warning signs:** All items fail with "Invalid input" errors

### Pitfall 3: Legacy Model Fallback Missing

**What goes wrong:** Error on v1 models "model not compatible with generate()"
**Why it happens:** Not checking `isSupportedLanguageModel()` before calling generate()
**How to avoid:** Use the existing pattern that checks and falls back to generateLegacy()
**Warning signs:** "AI SDK v4 model not compatible" errors

### Pitfall 4: Workflow Suspended State Not Handled

**What goes wrong:** Suspended workflow returns undefined, breaks scorer
**Why it happens:** Not handling `status === 'suspended'`
**How to avoid:** Return error for suspended workflows (per CONTEXT.md - not supported in v1)
**Warning signs:** Null output with no error recorded

### Pitfall 5: Double Scoring

**What goes wrong:** Scores computed twice - once in agent/workflow, once in runDataset
**Why it happens:** Not disabling built-in scorers on target
**How to avoid:** Pass `{ scorers: {} }` to agent, `{ disableScorers: true }` to workflow
**Warning signs:** Duplicate scores in database

## Code Examples

### Agent Execution Test

```typescript
// Source: packages/core/src/datasets/run/__tests__/runDataset.test.ts (EXISTING)
const createMockAgent = (response: string) => ({
  id: 'test-agent',
  name: 'Test Agent',
  getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
  generate: vi.fn().mockImplementation(async () => {
    return { text: response };
  }),
});
```

### Workflow Status Handling

```typescript
// Exhaustive status handling pattern from executor.ts
if (result.status === 'success') {
  return { output: result.result, error: null };
}

if (result.status === 'failed') {
  return { output: null, error: result.error?.message ?? 'Workflow failed' };
}

if (result.status === 'tripwire') {
  return { output: null, error: `Workflow tripwire: ${result.tripwire?.reason}` };
}

if (result.status === 'suspended') {
  return { output: null, error: 'Workflow suspended - not yet supported' };
}

if (result.status === 'paused') {
  return { output: null, error: 'Workflow paused - not yet supported' };
}

// TypeScript exhaustive check
const _exhaustiveCheck: never = result;
```

### Input Types for Agent

```typescript
// Agent.generate() accepts MessageListInput which includes:
type MessageListInput =
  | string // Simple text prompt
  | Message[] // Array of messages with role/content
  | { role: string; content: string }[] // Explicit message format
  | MessageList; // MessageList instance

// item.input can be any of these - agent normalizes internally
```

## State of the Art

| Old Approach              | Current Approach              | When Changed | Impact                  |
| ------------------------- | ----------------------------- | ------------ | ----------------------- |
| Manual stream consumption | generate() returns FullOutput | Current      | Simpler output handling |
| workflow.execute()        | createRun().start()           | Current      | Proper run lifecycle    |

**Deprecated/outdated:**

- `generateLegacy()` - only for v1 models, handled via `isSupportedLanguageModel()` check

## Open Questions

1. **Streaming Target Support**
   - What we know: CONTEXT.md says "Streaming agents: Collect full response, store final result"
   - What's unclear: Should we support stream() method at all, or only generate()?
   - Recommendation: Use generate() only - it returns complete result. Stream support can be added later if needed.

2. **Request Context Propagation**
   - What we know: CONTEXT.md deferred this: "Runtime context propagation - add when needed"
   - What's unclear: Current executeAgent() doesn't pass requestContext
   - Recommendation: Leave as-is for v1, add when use case emerges

3. **Agent Tool Execution During Runs**
   - What we know: CONTEXT.md says "Full agent behavior enabled - tools can be called"
   - What's unclear: Should we limit maxSteps or allow unlimited?
   - Recommendation: Use agent defaults - don't override maxSteps

## Sources

### Primary (HIGH confidence)

- `packages/core/src/datasets/run/executor.ts` - Existing implementation
- `packages/core/src/datasets/run/__tests__/runDataset.test.ts` - Existing tests
- `packages/core/src/agent/agent.ts` - Agent.generate() signature
- `packages/core/src/workflows/workflow.ts` - Workflow.createRun().start() pattern
- `packages/core/src/stream/base/output.ts` - FullOutput type definition
- `packages/core/src/workflows/types.ts` - WorkflowResult types

### Secondary (MEDIUM confidence)

- `packages/core/src/agent/utils.ts` - isSupportedLanguageModel() function
- `.planning/phases/03-agent-workflow-targets/03-CONTEXT.md` - Phase decisions

### Tertiary (LOW confidence)

- None - all findings from direct codebase analysis

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - already implemented in Phase 2
- Architecture: HIGH - verified against existing code
- Pitfalls: HIGH - derived from actual implementation and types

**Research date:** 2026-01-24
**Valid until:** 60 days (internal patterns are stable)

---

## Key Finding: Phase 3 Scope Assessment

**The executor is already implemented.** Phase 3 should focus on:

1. **Verification** - Ensure implementation matches CONTEXT.md decisions
2. **Testing** - Add edge case tests (input variations, error scenarios)
3. **Documentation** - Update any outdated comments

Current implementation status:

- [x] Agent execution with generate()
- [x] Legacy model fallback
- [x] Workflow execution with createRun().start()
- [x] All workflow status handling
- [x] Scorers disabled on targets
- [x] Error capture as string
- [x] Full output storage

Potential gaps to verify:

- [ ] Agent input accepts string OR messages array
- [ ] Workflow input uses `inputData` not `triggerData` (verify naming)
- [ ] Edge case: empty input
- [ ] Edge case: very large input
