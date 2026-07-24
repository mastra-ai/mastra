---
'@mastra/core': minor
---

Added `smoothStream()` and experimental agent stream transforms for buffering text and reasoning deltas into consistent, delayed chunks.

```typescript
const stream = result.fullStream.pipeThrough(smoothStream())
```
