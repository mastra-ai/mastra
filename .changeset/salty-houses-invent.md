---
'@mastra/libsql': minor
---

Added LibSQL storage for Harness attachment descriptors and provider object pointers so adapters can persist primitive, element, and object-backed attachment metadata.

```ts
await storage.saveAttachment({
  sessionId: 'session-1',
  attachmentId: 'selection-1',
  name: 'selection.json',
  mimeType: 'application/json',
  source: 'provider',
  data: new TextEncoder().encode('{}'),
  semantic: {
    kind: 'primitive',
    primitiveType: 'selection',
    object: {
      providerId: 'r2-dev',
      objectKey: 'harness/default/sessions/session-1/attachments/selection-1',
    },
  },
});
```
