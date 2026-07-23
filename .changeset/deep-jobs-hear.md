---
'@mastra/libsql': patch
---

Added LibSQL persistence for versioned dataset item scorer ID overrides, including cleared overrides and explicit empty arrays.

```typescript
await dataset.addItem({
  input: 'Evaluate this response',
  scorerIds: [],
});
```
