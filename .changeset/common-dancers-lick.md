---
'@mastra/core': minor
---

Add optional feedback replacement events and storage support. Keep the original feedback ID, trace ID, and timestamp when replacing a record. Storage callers can preserve existing feedback with `onConflict: 'ignore'`:

```typescript
await store.createFeedback({ feedback, onConflict: 'ignore' });
await store.replaceFeedback({ feedback: { ...feedback, value: -1 } });
```
