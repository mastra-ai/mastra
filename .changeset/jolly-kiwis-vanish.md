---
'@mastra/memory': patch
'@mastra/core': patch
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
---

**Refactored Observational Memory into modular architecture**

Restructured the Observational Memory (OM) engine from a single ~3,800-line monolithic class into a modular, strategy-based architecture. The public API and behavior are unchanged — this is a purely internal refactor that improves maintainability, testability, and separation of concerns.

**Why** — The original `ObservationalMemory` class handled everything: orchestration, LLM calling, observation logic for three different scopes, reflection, buffering coordination, turn lifecycle, and message processing. This made it difficult to reason about individual behaviors, test them in isolation, or extend the system. The refactor separates these responsibilities into focused modules.

**Observation strategies** — Extracted three duplicated observation code paths (~650 lines of conditionals) into pluggable strategy classes sharing a common `prepare → process → persist` lifecycle via an abstract base class. The correct strategy is selected automatically based on scope and buffering configuration.

```
observation-strategies/
  base.ts            — abstract ObservationStrategy + StrategyDeps interface
  sync.ts            — SyncObservationStrategy (thread-scoped synchronous)
  async-buffer.ts    — AsyncBufferObservationStrategy (background buffered)
  resource-scoped.ts — ResourceScopedObservationStrategy (multi-thread)
  index.ts           — static factory: ObservationStrategy.create(om, opts)
```

```ts
// Internal usage — strategies are selected and run automatically:
const strategy = ObservationStrategy.create(om, {
  record, threadId, resourceId, messages, cycleId, startedAt
});
const result = await strategy.run();
```

**Turn/Step abstraction** — Introduced `ObservationTurn` and `StepContext` to model the lifecycle of a single agent interaction. A Turn manages message loading, system message injection, record caching, and cleanup. A Step handles per-generation observation, activation, and reflection decisions. This replaced ~580 lines of inline orchestration in the processor with ~170 lines of structured calls.

```ts
// Internal lifecycle managed by the processor:
const turn = new ObservationTurn(om, memory, { threadId, resourceId });
await turn.start(messageList, writer);  // loads history, injects OM system message

const step = turn.step(0);
await step.prepare(messageList, writer); // activate buffered, maybe reflect
// ... agent generates response ...
await step.complete(messageList, writer); // observe new messages, buffer if needed

await turn.end(messageList, writer);     // persist, cleanup
```

**Dedicated runners** — Moved observer and reflector LLM-calling logic into `ObserverRunner` (194 lines) and `ReflectorRunner` (710 lines), separating prompt construction, degenerate output detection, retry logic, and compression level escalation from orchestration. `BufferingCoordinator` (175 lines) extracts the static buffering state machine and async operation tracking.

**Processor** — Added `ObservationalMemoryProcessor` implementing the `Processor` interface, bridging the OM engine with the AI SDK message pipeline. It owns the decision of *when* to buffer, activate, observe, and reflect — while the OM engine owns *how* to do each operation.

```ts
// The processor is created automatically by Memory when OM is enabled.
// It plugs into the AI SDK message pipeline:
const memory = new Memory({
  storage: new InMemoryStore(),
  options: {
    observationalMemory: {
      enabled: true,
      observation: { model, messageTokens: 500 },
      reflection: { model, observationTokens: 10_000 },
    },
  },
});

// For direct access to the OM engine (e.g. for manual observe/buffer/activate):
const om = await memory.omEngine;
```

**Unified OM engine instantiation** — Replaced the duplicated `getOMEngine()` singleton and per-call `createOMProcessor()` engine creation with a single lazy `omEngine` property on the `Memory` class. This eliminates config drift between the legacy `getContext()` API and the processor pipeline — both now share the same `ObservationalMemory` instance with the full configuration.

```ts
// Before (casting required, config could drift):
const om = (await (memory as any).getOMEngine()) as ObservationalMemory;

// After (typed, single shared engine):
const om = await memory.omEngine;
```

**Improved observation activation atomicity** — Added conditional WHERE clauses to `activateBufferedObservations` in all storage adapters (pg, libsql, mongodb) to prevent duplicate chunk swaps when concurrent processes attempt activation simultaneously. If chunks have already been cleared by another process, the operation returns early with zero counts instead of corrupting state.

**Compression start level from model context** — Integrated model-aware compression start levels into the `ReflectorRunner`. Models like `gemini-2.5-flash` that struggle with light compression now start at compression level 2 instead of 1, reducing wasted reflection retries.

**Pure function extraction** — Moved reusable helpers into `message-utils.ts`: `filterObservedMessages`, `getBufferedChunks`, `sortThreadsByOldestMessage`, `stripThreadTags`. Eliminated dead code including `isObserving` DB flag, `countMessageTokens`, `acquireObservingLock`/`releaseObservingLock`, and ~10 cascading dead private methods.

**Cleanup** — Dropped `threadIdCache` (pointless memoization), removed `as any` casts for private method access (made methods properly public with `@internal` tsdoc), replaced sealed-ID-based tracking with message-level `metadata.mastra.sealed` flag checks.
