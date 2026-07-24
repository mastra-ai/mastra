---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed durable agent runs never persisting their conversation to memory when the agentic loop executes on a remote worker — the standard `@mastra/inngest` `connect()` topology. A completed run left no thread messages behind, so the next turn on the same thread recalled nothing and the agent behaved as if the conversation had never happened. `processOutputResult` output processors and thread-title generation were skipped the same way.

Two root causes, both in the finish path:

- `resolveRuntimeDependencies` rebuilt `memory` and the processor pipeline on the worker and wrote them back into the per-process run registry, but built the `SaveQueueManager` *after* the write-back — so the registry entry never carried it and the finish-time persistence guard always failed cross-process.
- The Inngest agentic workflow's terminal step had no finish-time side effects at all: core's `createDurableAgenticWorkflow` runs output processors, persists memory, and generates the thread title in its terminal map, but `createInngestDurableAgenticWorkflow` never ported those blocks.

The finish-time side effects now live in a shared `runDurableFinishSideEffects` helper (exported from `@mastra/core/agent/durable`) used by both engines. It first rebuilds the runtime dependencies from the Mastra instance when the process-local registry entry is missing or incomplete — covering the case where the terminal step lands on a different worker than the LLM step — then runs the same output-processor, memory-persistence, and thread-title blocks as the in-process engine, before the finish event is emitted. Finish-time spans (`processor_run` and their `memory_operation` children) are parented under the run's rebuilt `AGENT_RUN` span instead of the terminal step's internal workflow span, which is never exported and left them orphaned in trace storage.

Thread-title generation also works cross-process now: the title logic was extracted from the preparation-time registry closure (which only exists in the process that called `stream()`) into an exported `generateDurableThreadTitle`, and the finish helper calls it directly with the agent and memory rebuilt from the Mastra instance when the closure is absent.

Adds a cross-process regression test that spawns a real connect worker and asserts persistence (user + assistant messages and the thread row exist after the run), thread-title generation, and recall (a second turn's model prompt contains the first turn's history).
