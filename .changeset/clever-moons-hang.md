---
'@mastra/platform-workspace': minor
---

Added startup observability to `PlatformSandbox`. New optional `sessionId` and `threadId` options let you correlate all sandbox startup activity with the session that triggered it, and the sandbox now logs how long startup took and whether it became reachable.

```ts
import { PlatformSandbox } from '@mastra/platform-workspace';

const sandbox = new PlatformSandbox({
  projectId: 'proj_123',
  environmentId: 'env_123',
  sessionId: 'session_abc', // correlate startup logs with your session
  threadId: 'thread_xyz', // optional finer-grained correlation
});
```
