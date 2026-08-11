---
'@mastra/deployer-sandbox': minor
---

Added `attachWorkerDeployment()` so restarted supervisors can reconstruct worker handles from persisted sandbox and execution identities.

```typescript
const worker = await attachWorkerDeployment({ sandbox, executionId });
const status = await worker.status();
const output = await worker.readOutput('stdout', { offset });
```
