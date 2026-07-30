---
'@mastra/inngest': patch
---

Agent/tool steps now execute through core's shared entry executors.

`createStep(agent)` and `createStep(tool)` from `@mastra/inngest` used to carry their own inline copies of the agent-streaming and tool-execution logic, forked from `@mastra/core`. Two things changed:

1. Because these steps now carry the `__agentRef` / `__toolRef` metadata, every workflow-builder position (`.then`, `.parallel`, `.branch`, `.dowhile`, `.dountil`, `.foreach`) converts them into declarative `agent` / `tool` graph entries, which the Inngest engine executes via the executors inherited from `DefaultExecutionEngine` (`runAgentEntry` / `runToolEntry`) — with Inngest durability preserved (`executeStepWithRetry` still wraps them in `step.run`).
2. The factories themselves now delegate to `@mastra/core`'s `createStepFromAgent` / `createStepFromTool`, so the same executors also run when a step's `execute` is invoked directly. The forked inline implementations were deleted.

Behavioral consequences of converging on the core executors (uniform whether the step enters a graph or is executed directly):

- **Tripwire chunks now abort the step.** The old inline copy had no tripwire handling — a `tripwire` chunk emitted by an output processor was forwarded downstream and the step returned `{ text }` as a success. The step now throws `TripWire` (with the processor's reason/retry/metadata), matching `@mastra/core` workflows.
- **The agent's `onFinish` result is the sole source of the step's final text.** The old copy raced `modelOutput.text` against `onFinish`, so a throwing output processor could resolve the step with `{ text: '' }`. This adopts core's fix.
- **Tool execution context gains `abortSignal`, top-level `resumeData`, and the resolved observability context**, matching what tools receive in `@mastra/core` workflows.
- **A v1 model without `streamLegacy` no longer throws the Inngest-specific "does not implement streamLegacy" error** — it falls through to `stream()` like core does.
