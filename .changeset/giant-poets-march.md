---
'@mastra/docker': minor
---

Added @mastra/docker, a Docker container sandbox provider for Mastra workspaces. Executes commands inside local Docker containers using long-lived containers with `docker exec`. Supports bind mounts, environment variables, container reconnection by label, custom images, and network configuration. Targets local development, CI/CD, air-gapped deployments, and cost-sensitive scenarios where cloud sandboxes are unnecessary.

**Usage**

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { DockerSandbox } from '@mastra/docker';

const workspace = new Workspace({
  sandbox: new DockerSandbox({
    image: 'node:22-slim',
    timeout: 60_000,
  }),
});

const agent = new Agent({
  name: 'dev-agent',
  model: 'anthropic/claude-opus-4-6',
  workspace,
});
```
