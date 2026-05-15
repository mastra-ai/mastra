---
"@mastra/core": patch
"@mastra/libsql": patch
---

Added retry-safe `session.message()` admission for Harness v1 using the `admissionId` parameter.

```ts
await session.message({ content: 'Summarize this issue', admissionId: 'msg-123' });
await session.message({ content: 'Summarize this issue', admissionId: 'msg-123' }); // duplicate retry
```
