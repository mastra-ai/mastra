---
'@mastra/oracledb': minor
---

Added configurable age-based pruning for Oracle Database observability spans and logs. Requires `@mastra/core` 1.68 or newer.

```typescript
const storage = new OracleStore({
  ...connection,
  retention: {
    observability: {
      spans: { maxAge: '30d' },
      logs: { maxAge: '7d' },
    },
  },
});

await storage.prune();
```
