---
'@mastra/libsql': patch
---

Dataset item scorer selections now persist across LibSQL writes and reads. Setting `scorerIds` to `null` clears an item override, while `[]` remains an explicit override with no scorers.

```typescript
await dataset.addItem({
  input: 'Evaluate this response',
  scorerIds: [],
});
```
