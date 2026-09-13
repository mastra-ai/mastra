---
'@mastra/core': minor
---

Added opt-in `MessageHistory` filtering so saved history can remove raw tool-call arguments and results while retaining approved compact model output. Native consumers can keep filtered message IDs available as payload-free cursor anchors.

```ts
new MessageHistory({
  storage,
  toolCallFilter: {
    exclude: ['search'],
    preserveModelOutput: true,
    maxModelOutputBytes: 4096,
  },
});
```
