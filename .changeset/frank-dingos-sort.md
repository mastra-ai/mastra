---
'@mastra/core': minor
---

Added Harness attachment descriptors for primitive and element payloads. Developers can upload structured values and renderable elements through the same guarded attachment lifecycle used for files.

```ts
const attachment = await harness.attachments.upload({
  sessionId: session.id,
  kind: 'primitive',
  name: 'selection.json',
  primitiveType: 'selection',
  value: { ids: ['paper-1', 'paper-2'] },
});
```
