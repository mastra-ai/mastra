---
'@mastra/core': patch
'@mastra/ai-sdk': patch
---

Fixed usage aggregation so omitted provider token counts remain unknown across agent, workflow, and durable streams. Reported cache and reasoning details remain additive.

`AccumulatedUsage` from `@mastra/core/agent/durable` and `WorkflowDataPart['data']['output']['usage']` from `@mastra/ai-sdk` now represent incomplete primary counters as `undefined` instead of measured zeroes. When every input and output count is known, `totalTokens` can still be derived from those complete aggregates even if the provider omitted its total. Derived totals now sum input and output tokens without adding `reasoningTokens`.

For example, `{ inputTokens: 10, outputTokens: 20, totalTokens: 30 }` followed by `{ outputTokens: 5 }` now produces `{ inputTokens: undefined, outputTokens: 25, totalTokens: undefined }`.

Observability still records known per-step token contributions and marks their aggregate as incomplete. `TokenCostControl` treats the partial estimated cost as a known lower bound: hard and soft thresholds still apply when that lower bound crosses them, while lower values do not imply the complete cost is under budget. The Responses API returns `usage: null` for an incomplete aggregate instead of fabricating zero-valued counters.

Durable iteration state written by this version may omit unknown primary counters and cannot be resumed by an older worker after a rollback. (#23469)
