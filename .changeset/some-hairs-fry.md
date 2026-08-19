---
'@mastra/railway': patch
---

Added support for booting new Railway sandboxes from a fallback checkpoint while keeping future snapshots isolated to the sandbox's own checkpoint.

```typescript
const sandbox = new RailwaySandbox({ seedCheckpointName: 'repo-base' });
```
