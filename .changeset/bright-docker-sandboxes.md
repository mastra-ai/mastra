---
'@mastra/docker': minor
---

Add Docker Cloud Sandboxes microVM support through `DockerSandboxesSandbox`, alongside the existing container-based `DockerSandbox`. Supports reconnection, streamed commands, cancellation, timeouts, and file operations.

```ts
import { DockerSandboxesSandbox } from '@mastra/docker';

const sandbox = new DockerSandboxesSandbox({ id: 'my-workspace', image: 'ubuntu:24.04' });
await sandbox.start();
const result = await sandbox.executeCommand('echo', ['hello']);
```
