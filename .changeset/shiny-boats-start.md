---
'@mastra/libsql': minor
'@mastra/mongodb': minor
'@mastra/mysql': minor
'@mastra/pg': minor
'@mastra/spanner': minor
---

Added persistence for dataset item undeclared tool policies.

```typescript
await dataset.addItem({
  input: 'What is the weather?',
  unmockedToolPolicy: 'deny',
});
```
