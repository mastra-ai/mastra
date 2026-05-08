### 12.14 File attachments

```ts
import fs from 'node:fs/promises';

const session = await harness.session({ resourceId: 'local-user' });

// Inline form — the harness flushes bytes to the attachment store before
// queuing, so this survives a server restart.
const screenshot = await fs.readFile('./screenshot.png');
session.queue({
  content: 'What does this UI bug look like?',
  files: [
    { kind: 'inline', name: 'screenshot.png', mimeType: 'image/png', data: screenshot },
  ],
});

// URL form — for assets already hosted somewhere reachable. The reference
// is stored as-is; bytes never touch harness storage.
session.queue({
  content: 'Compare this design to the current implementation',
  files: [
    { kind: 'url', name: 'figma-export.png', mimeType: 'image/png', url: 'https://cdn.example.com/asset/abc.png' },
  ],
});

// Pre-upload form — useful for browser drag-drop with progress UI.
const { attachmentId } = await session.uploadAttachment({
  name: 'logs.txt',
  mimeType: 'text/plain',
  data: largeBuffer,
  onProgress: (loaded, total) => console.log(`${(loaded / total * 100).toFixed(1)}%`),
});

session.queue({
  content: 'Find the root cause in these logs',
  files: [
    { kind: 'ref', name: 'logs.txt', mimeType: 'text/plain', attachmentId },
  ],
});

// The attachment lives until the session is closed, or you can drop it early.
await session.deleteAttachment({ attachmentId });
```
