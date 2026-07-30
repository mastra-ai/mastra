---
'@mastra/inngest': patch
---

Agent and tool steps in Inngest workflows now behave identically to `@mastra/core` workflows — same streaming, tripwire, and tool-execution semantics — while keeping Inngest durability (steps still run inside `step.run` with retries).

Previously, `createStep(agent)` and `createStep(tool)` from `@mastra/inngest` carried their own inline copies of the agent-streaming and tool-execution logic, forked from `@mastra/core`. Both now execute through core's shared entry executors, whether the step enters a workflow graph or its `execute` is invoked directly. The forked inline implementations were deleted.

What changes for users:

- **Tripwire chunks now abort the step.** The old inline copy had no tripwire handling — a `tripwire` chunk emitted by an output processor was forwarded downstream and the step returned `{ text }` as a success. The step now throws `TripWire` (with the processor's reason/retry/metadata), matching `@mastra/core` workflows.
- **The agent's `onFinish` result is the sole source of the step's final text.** The old copy raced `modelOutput.text` against `onFinish`, so a throwing output processor could resolve the step with `{ text: '' }`. This adopts core's fix.
- **Tool execution context gains `abortSignal`, top-level `resumeData`, and the resolved observability context**, matching what tools receive in `@mastra/core` workflows.
- **A v1 model without `streamLegacy` no longer throws the Inngest-specific "does not implement streamLegacy" error** — it falls through to `stream()` like core does.
