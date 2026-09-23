---
'@mastra/observability': minor
'@mastra/server': patch
'@mastra/core': patch
---

Honor `tracingOptions.rootSpanName` when creating a root span. The caller-supplied name replaces the default `agent run: '<id>'` or `workflow run: '<id>'` name on the root span only. Works for the default and Inngest workflow engines because the name is applied when the span starts, before any durable snapshot is taken.

```ts
const span = observability.startSpan({
  type: SpanType.WORKFLOW_RUN,
  name: "workflow run: 'skill-analyze'",
  tracingOptions: { rootSpanName: "skill-analyze: typescript" },
});

span.name; // "skill-analyze: typescript"
```

Related: https://github.com/mastra-ai/mastra/issues/24518
