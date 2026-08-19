---
'@mastra/platform-workspace': patch
---

Added fallback checkpoint forwarding for Platform sandboxes so the workspace proxy can seed fresh sessions without changing their primary recovery key.

```typescript
const sandbox = new PlatformSandbox({
  id: 'session-42',
  seedCheckpointName: 'repo-base',
});
```
