---
'@mastra/core': patch
---

Close three behavioral parity gaps between `DurableAgent` and the in-memory `Agent` loop:

- **`isTaskComplete` scorers now see `requestContext`.** The durable `is-task-complete` step previously passed `customContext: undefined` to scorers. `prepareForDurableExecution` now snapshots the JSON-safe subset of `requestContext.entries()` onto the workflow input, and the step forwards it as `customContext` so scorers observe the same context they do on the non-durable agent. Non-JSON-serializable values are dropped; do not store secrets in `RequestContext` if you persist durable agent snapshots.
- **Provider-tool fallback on durable `tool-call`.** Tool-call resolution now falls back to `findProviderToolByName` against the run registry's tools (and against `mastra` tools) before emitting `ToolNotFoundError`, so provider-only tools the model invokes resolve and execute on the durable path the same way they do on the regular agent.
- **`messageId` rotation between iterations.** The durable `dowhile` predicate now rotates `state.messageId` (using `mastra.generateId()` with a `crypto.randomUUID()` fallback) when the loop will continue, so each continued iteration's assistant message lands under a distinct id rather than reusing the first iteration's id.
