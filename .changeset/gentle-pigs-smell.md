---
'@mastra/client-js': minor
---

Added typed single-record reads:

```ts
const { score } = await client.getScore(scoreId);
const { feedback } = await client.getFeedback(feedbackId);
```

Missing records return `{ score: null }` or `{ feedback: null }`. Both methods preserve the configured API prefix, credentials, and headers. Pass unencoded IDs; the client encodes them as URL path segments.
