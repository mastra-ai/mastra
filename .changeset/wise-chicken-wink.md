---
'@mastra/observability': patch
'@mastra/server': patch
'@mastra/core': patch
---

Accept `rootSpanName` in `tracingOptions` on agent and workflow HTTP routes so clients can set a per-run root span name.

```http
POST /api/workflows/skillAnalyze/start-async
{
  "inputData": { "skillId": "typescript" },
  "tracingOptions": { "rootSpanName": "skill-analyze: typescript" }
}
```

Related: https://github.com/mastra-ai/mastra/issues/24518
