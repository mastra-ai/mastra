---
"@mastra/core": minor
---

Added an `openIfEmpty` option to streamed tool display results. Set it to
`false` when a tool lifecycle chunk should update only an active streaming
session:

```typescript
toolDisplay: event => ({
  kind: 'stream',
  chunk: createTaskUpdate(event),
  openIfEmpty: false,
})
```

By default, stream results continue to open a session when needed. Static
channels continue to use plain-text fallback rendering.
