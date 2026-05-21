---
'@mastra/core': minor
---

Added Harness v1 attachment management: upload and delete attachments with support for files, primitives, and elements.

Usage example:

```ts
const fileRef = await harness.attachments.upload({
  sessionId,
  kind: 'file',
  filename: 'document.pdf',
  contentType: 'application/pdf',
  data: fileBuffer,
});

const primitiveRef = await harness.attachments.upload({
  sessionId,
  kind: 'primitive',
  name: 'selection.json',
  primitiveType: 'selection',
  value: { ids: ['paper-1', 'paper-2'] },
});

await harness.attachments.delete({
  sessionId,
  attachmentId: fileRef.attachmentId,
});
```
