---
'@mastra/core': patch
---

Fix tracing context propagation to agent steps in workflows

When creating a workflow step from an agent using `createStep(myAgent)`, the tracing context was not being passed to the agent's `stream()` and `streamLegacy()` methods. This caused tracing spans to break in the workflow chain.

This fix ensures that `tracingContext` is properly propagated to both agent.stream() and agent.streamLegacy() calls, matching the behavior of tool steps which already propagate tracingContext correctly.
