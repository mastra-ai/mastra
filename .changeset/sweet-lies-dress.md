---
'@mastra/core': patch
'@mastra/ai-sdk': patch
---

Fixed usage aggregation so omitted primary provider token counts remain unknown across agent, workflow, and durable streams. Reported cache and reasoning details remain additive.

`AccumulatedUsage` from `@mastra/core/agent/durable` and `WorkflowDataPart['data']['output']['usage']` from `@mastra/ai-sdk` now represent omitted primary counters as `undefined` instead of measured zeroes.

For example, `{ inputTokens: 10, outputTokens: 20, totalTokens: 30 }` followed by `{ outputTokens: 5 }` now produces `{ inputTokens: undefined, outputTokens: 25, totalTokens: undefined }`.

Durable iteration state written by this version may omit unknown primary counters and cannot be resumed by an older worker after a rollback. (#23469)
