---
'@mastra/server': minor
---

Added dataset API support for storing per-item undeclared tool policies and reporting denied tool calls.

```typescript
await fetch(`/api/datasets/${datasetId}/items`, {
  method: 'POST',
  body: JSON.stringify({
    input: 'What is the weather?',
    unmockedToolPolicy: 'deny',
  }),
});

const failureCode = experimentResult.toolMockReport?.failure?.code;
```
