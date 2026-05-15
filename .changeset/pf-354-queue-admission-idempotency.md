---
'@mastra/core': patch
'@mastra/libsql': patch
---

Added retry-safe Harness v1 queue admission through `session.queue({ admissionId })`.

```ts
await session.queue({ content: 'Process this later', admissionId: 'queue-123' });
await session.queue({ content: 'Process this later', admissionId: 'queue-123' }); // duplicate retry
```
