---
'@mastra/pg': minor
'@mastra/duckdb': minor
'@mastra/clickhouse': minor
---

Support full feedback replacement and protected creates:

```typescript
await store.createFeedback({ feedback, onConflict: 'ignore' });
await store.replaceFeedback({ feedback: { ...feedback, value: -1 } });
```

Keep the original ID, trace ID, timestamp, and tenant when replacing feedback. ClickHouse uses its existing schema; overlapping writes from separate processes are not ordered reliably.
