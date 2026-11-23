---
'@mastra/core': minor
---

Added an `optional` flag to `mastra.getWorkspaceById()`. With `{ optional: true }` it returns `undefined` for an unknown ID instead of logging and throwing an error, so you can check whether a workspace exists before creating it.

```typescript
const existing = mastra.getWorkspaceById('workspace-123', { optional: true });
```
