---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fix durable agents losing the caller's request context after the first iteration.

`prepareForDurableExecution` snapshots the caller's `RequestContext` onto the workflow input as `requestContextEntries`, and steps that rebuild the model and tools from the Mastra instance restore the context from that snapshot. The snapshot was dropped when iteration state was rebuilt and was never forwarded to the LLM step, so from the second iteration on, dynamic `model`, `tools`, `memory` and `workspace` resolvers ran against an empty context and silently fell back to defaults. This affected every path that cannot use the in-process run registry: Inngest workers, recovered runs, and evicted registry entries.

The snapshot is now declared on the iteration state and LLM step input schemas, carried forward by `createBaseIterationStateUpdate`, and forwarded by the `map-to-llm-input` step in both the core and Inngest durable agentic workflows.
