---
'@mastra/core': minor
---

Added `Mastra.getWorkerConfig()` for reporting the active worker topology and serializable instance-level settings so deployment tools can compare runtime and build-time configuration.

```ts
const workerConfig = mastra.getWorkerConfig();
```
