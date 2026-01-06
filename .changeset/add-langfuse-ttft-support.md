---
'@mastra/core': patch
'@mastra/observability': patch
'@mastra/langfuse': patch
---

Add time-to-first-token (TTFT) support for Langfuse integration

Adds `completionStartTime` to model generation spans, which Langfuse uses to calculate TTFT metrics. The timestamp is automatically captured when the first content chunk arrives during streaming.

```typescript
// completionStartTime is now automatically captured and sent to Langfuse
// enabling TTFT metrics in your Langfuse dashboard
const result = await agent.stream('Hello');
```

