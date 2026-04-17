# @mastra/docker

## 0.1.0-alpha.0

### Minor Changes

- Added @mastra/docker, a Docker container sandbox provider for Mastra workspaces. Executes commands inside local Docker containers using long-lived containers with `docker exec`. Supports bind mounts, environment variables, container reconnection by label, custom images, and network configuration. Targets local development, CI/CD, air-gapped deployments, and cost-sensitive scenarios where cloud sandboxes are unnecessary. ([#14500](https://github.com/mastra-ai/mastra/pull/14500))

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

### Patch Changes

- Fixed process kill to target the entire process group (negative PID) with fallback, ensuring child processes spawned inside the container are properly cleaned up. Tracked process handles are now cleared after container stop or destroy to prevent stale references. ([#14500](https://github.com/mastra-ai/mastra/pull/14500))

- Updated dependencies [[`0474c2b`](https://github.com/mastra-ai/mastra/commit/0474c2b2e7c7e1ad8691dca031284841391ff1ef), [`f607106`](https://github.com/mastra-ai/mastra/commit/f607106854c6416c4a07d4082604b9f66d047221), [`62919a6`](https://github.com/mastra-ai/mastra/commit/62919a6ee0fbf3779ad21a97b1ec6696515d5104), [`0fd90a2`](https://github.com/mastra-ai/mastra/commit/0fd90a215caf5fca8099c15a67ca03e4427747a3)]:
  - @mastra/core@1.26.0-alpha.4
