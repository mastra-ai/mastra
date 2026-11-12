---
'@mastra/docker': minor
---

Add Docker Cloud Sandboxes microVM support through `DockerSandboxesSandbox`, alongside the existing container-based `DockerSandbox`. Supports reconnection, streamed commands, cancellation, timeouts, and file operations.

```ts
import { Sandboxes, pat } from '@docker/sandboxes';
import { DockerSandboxesSandbox } from '@mastra/docker';

const client = new Sandboxes({
  auth: pat({ username: process.env.DOCKER_USERNAME!, personalAccessToken: process.env.DOCKER_PAT! }),
});
const sandbox = new DockerSandboxesSandbox({ id: 'my-workspace', image: 'ubuntu:24.04', client });
await sandbox.start();
const result = await sandbox.executeCommand('echo', ['hello']);
```
