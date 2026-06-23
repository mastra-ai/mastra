---
'@mastra/core': patch
---

Fixed durable agent input/output processor spans orphaning when an `AGENT_RUN` root was present. Following #18083, durable runs opened an `AGENT_RUN` span but `prepareForDurableExecution` and the durable agentic-loop output-processor step still passed `{} as any` as the observability context to `runInputProcessors` / `runOutputProcessors`. Agent-level processors (including the auto-injected `MessageHistory` when memory is configured) emitted `processor_run` spans with no parent — and their inner `MEMORY_OPERATION` children were dropped entirely because the processor bails out when `currentSpan` is undefined. The `AGENT_RUN` span is now opened before input processors run and the durable workflow's output-processor step forwards its step `tracingContext` to the runner, so processor and memory-operation spans nest under `AGENT_RUN` on every durable turn.
