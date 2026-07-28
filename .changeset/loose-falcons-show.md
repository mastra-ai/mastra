---
'@mastra/deployer-sandbox': minor
---

Run isolated non-HTTP workers with bounded input, separate byte-preserving output streams, cancellation, relaunch, and cleanup controls.

```ts
import { deployWorkerToSandbox } from '@mastra/deployer-sandbox';

const worker = await deployWorkerToSandbox({
  sandbox,
  dir: './dist/worker',
  executionId: 'job-1',
  command: 'node',
  args: ['index.mjs'],
  input: { type: 'stdin', data: request },
});

const stdout = await worker.readOutput('stdout');
await worker.cancel();
const retry = await worker.relaunch({ executionId: 'job-2' });
await retry.destroy();
```
