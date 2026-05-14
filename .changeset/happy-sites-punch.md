---
'@mastra/core': patch
---

Hide internal workflow spans from Mastra-owned plumbing in exported traces. The user-facing entry spans (`SCORER_RUN`, `AGENT_RUN`, `TOOL_CALL`, `MODEL_GENERATION`) still appear, but the `WORKFLOW_RUN` and `WORKFLOW_STEP` spans Mastra creates as plumbing around them are now marked internal and filtered out by default.

Affects:

- the scorer pipeline workflow created per scorer in `evals/base.ts`
- the `__batch-scoring-traces` workflow used to score recorded traces
- the `bg-task-processor` background-task scheduler workflow and its retry loop
- the agent.network() workflows (`Agent-Network-Outer-Workflow`, `iteration-with-validation`, `agent-loop-main-workflow`)
- the durable agent execution workflows (`AGENTIC_LOOP`, `AGENTIC_EXECUTION`)

User-defined work invoked from steps — e.g. a judge agent in a scorer, your own agents in agent.network(), or a tool call inside a background task — keeps its own tracing policy and remains visible in exported traces.

To inspect the internal workflow spans (e.g. for debugging Mastra's behavior), set `includeInternalSpans: true` on your Observability config:

```ts
new Observability({
  configs: {
    default: {
      exporters: [...],
      includeInternalSpans: true,
    },
  },
});
```
