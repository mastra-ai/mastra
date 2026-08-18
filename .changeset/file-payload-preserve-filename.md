---
"@mastra/core": minor
---

Added optional `filename` property to `FilePayload`. When an agent emits a file chunk with a filename, the Channel layer now preserves it through to the Chat SDK adapter instead of generating a name from the MIME type. Existing file chunks without a filename continue using the `generated.<ext>` fallback.

```ts
const chunk: FilePayload = {
  data: fileBuffer,
  mimeType: 'text/plain',
  filename: 'report.txt', // preserved through to the channel adapter
};
```
