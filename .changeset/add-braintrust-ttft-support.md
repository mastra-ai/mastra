---
'@mastra/braintrust': patch
'@mastra/observability': patch
---

Add time-to-first-token (TTFT) support for Braintrust integration

Adds `time_to_first_token` metric to Braintrust spans, populated from the `completionStartTime` attribute captured when the first streaming chunk arrives.

```typescript
// time_to_first_token is now automatically sent to Braintrust
// as part of span metrics during streaming
const result = await agent.stream('Hello');
```

