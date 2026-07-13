---
'@mastra/client-js': minor
'@mastra/server': minor
'mastra': patch
---

Added image attachment support to agent controller chat. You can now send images (and other files) with a message, and the Mastra Code web chat lets you attach, paste, or drag-and-drop images which render inline in the transcript.

```ts
await session.sendMessage('What is in this screenshot?', {
  files: [{ data: base64Png, mediaType: 'image/png', filename: 'screenshot.png' }],
});
```
