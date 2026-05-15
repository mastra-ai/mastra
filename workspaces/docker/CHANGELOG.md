# @mastra/docker

## 0.2.0

### Minor Changes

- Docker sandbox containers now support resource limits and security hardening through Docker HostConfig options. Configure memory, CPU quota, process IDs, capabilities, security options, read-only root filesystems, and tmpfs mounts. ([#16577](https://github.com/mastra-ai/mastra/pull/16577))

  ```typescript
  const sandbox = new DockerSandbox({
    memory: 512 * 1024 * 1024,
    memorySwap: 512 * 1024 * 1024,
    cpuQuota: 100_000,
    pidsLimit: 256,
    readonlyRootfs: true,
    capDrop: ['ALL'],
    securityOpt: ['no-new-privileges:true'],
  });
  ```

### Patch Changes

- Updated dependencies [[`20787de`](https://github.com/mastra-ai/mastra/commit/20787de5965234a1af28fe35f49437c537dbfa0d), [`784ad98`](https://github.com/mastra-ai/mastra/commit/784ad989549de91dc5d33ab8ef36caa6f7dcd34e), [`fceae1f`](https://github.com/mastra-ai/mastra/commit/fceae1f5f5db4722cb078a663c6eb4bd22944123), [`090a647`](https://github.com/mastra-ai/mastra/commit/090a647ba5a66d36f203f9f49457e03a1ff4e6fb), [`bf02acb`](https://github.com/mastra-ai/mastra/commit/bf02acbb8a6110f638ac844e89f1ebf04cb7fe74), [`090a647`](https://github.com/mastra-ai/mastra/commit/090a647ba5a66d36f203f9f49457e03a1ff4e6fb), [`bdb4cbf`](https://github.com/mastra-ai/mastra/commit/bdb4cbf8ba4b685d7481f28bb9dc3de6c79c9ed2), [`0fd3fbe`](https://github.com/mastra-ai/mastra/commit/0fd3fbe40fb63657aedd72f6e7b38c8e8ee6940d), [`f84447d`](https://github.com/mastra-ai/mastra/commit/f84447d6c80f3471836a9b300d246b331fb47e0d), [`a1a5b3e`](https://github.com/mastra-ai/mastra/commit/a1a5b3e42ab2ca5161ea21db59ebf28442680fa7), [`af84f57`](https://github.com/mastra-ai/mastra/commit/af84f571ed762e92e8e61c5f9a72363520914274), [`8b3c6f9`](https://github.com/mastra-ai/mastra/commit/8b3c6f90f7879833ba7d1bc70937e1d8f69d0804), [`fed0475`](https://github.com/mastra-ai/mastra/commit/fed0475ccfea31e4fc251469ac05640d0742c1f0), [`0d53730`](https://github.com/mastra-ai/mastra/commit/0d53730c1ed87ef80c87caa5701c4170ea8028e6), [`522f44d`](https://github.com/mastra-ai/mastra/commit/522f44d947214bfc06cff50599bae1ef3494880d)]:
  - @mastra/core@1.34.0

## 0.2.0-alpha.0

### Minor Changes

- Docker sandbox containers now support resource limits and security hardening through Docker HostConfig options. Configure memory, CPU quota, process IDs, capabilities, security options, read-only root filesystems, and tmpfs mounts. ([#16577](https://github.com/mastra-ai/mastra/pull/16577))

  ```typescript
  const sandbox = new DockerSandbox({
    memory: 512 * 1024 * 1024,
    memorySwap: 512 * 1024 * 1024,
    cpuQuota: 100_000,
    pidsLimit: 256,
    readonlyRootfs: true,
    capDrop: ['ALL'],
    securityOpt: ['no-new-privileges:true'],
  });
  ```

### Patch Changes

- Updated dependencies [[`fceae1f`](https://github.com/mastra-ai/mastra/commit/fceae1f5f5db4722cb078a663c6eb4bd22944123), [`bf02acb`](https://github.com/mastra-ai/mastra/commit/bf02acbb8a6110f638ac844e89f1ebf04cb7fe74), [`0fd3fbe`](https://github.com/mastra-ai/mastra/commit/0fd3fbe40fb63657aedd72f6e7b38c8e8ee6940d), [`fed0475`](https://github.com/mastra-ai/mastra/commit/fed0475ccfea31e4fc251469ac05640d0742c1f0), [`522f44d`](https://github.com/mastra-ai/mastra/commit/522f44d947214bfc06cff50599bae1ef3494880d)]:
  - @mastra/core@1.34.0-alpha.1

## 0.1.0

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

- Updated dependencies [[`20f59b8`](https://github.com/mastra-ai/mastra/commit/20f59b876cf91199efbc49a0e36b391240708f08), [`aba393e`](https://github.com/mastra-ai/mastra/commit/aba393e2da7390c69b80e516a4f153cda6f09376), [`3d83d06`](https://github.com/mastra-ai/mastra/commit/3d83d06f776f00fb5f4163dddd32a030c5c20844), [`e2687a7`](https://github.com/mastra-ai/mastra/commit/e2687a7408790c384563816a9a28ed06735684c9), [`fdd54cf`](https://github.com/mastra-ai/mastra/commit/fdd54cf612a9af876e9fdd85e534454f6e7dd518), [`6315317`](https://github.com/mastra-ai/mastra/commit/63153175fe9a7b224e5be7c209bbebc01dd9b0d5), [`a371ac5`](https://github.com/mastra-ai/mastra/commit/a371ac534aa1bb368a1acf9d8b313378dfdc787e), [`0474c2b`](https://github.com/mastra-ai/mastra/commit/0474c2b2e7c7e1ad8691dca031284841391ff1ef), [`0a5fa1d`](https://github.com/mastra-ai/mastra/commit/0a5fa1d3cb0583889d06687155f26fd7d2edc76c), [`7e0e63e`](https://github.com/mastra-ai/mastra/commit/7e0e63e2e485e84442351f4c7a79a424c83539dc), [`ea43e64`](https://github.com/mastra-ai/mastra/commit/ea43e646dd95d507694b6112b0bf1df22ad552b2), [`f607106`](https://github.com/mastra-ai/mastra/commit/f607106854c6416c4a07d4082604b9f66d047221), [`30456b6`](https://github.com/mastra-ai/mastra/commit/30456b6b08c8fd17e109dd093b73d93b65e83bc5), [`9d11a8c`](https://github.com/mastra-ai/mastra/commit/9d11a8c1c8924eb975a245a5884d40ca1b7e0491), [`9d3b24b`](https://github.com/mastra-ai/mastra/commit/9d3b24b19407ae9c09586cf7766d38dc4dff4a69), [`00d1b16`](https://github.com/mastra-ai/mastra/commit/00d1b16b401199cb294fa23f43336547db4dca9b), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`62919a6`](https://github.com/mastra-ai/mastra/commit/62919a6ee0fbf3779ad21a97b1ec6696515d5104), [`d246696`](https://github.com/mastra-ai/mastra/commit/d246696139a3144a5b21b042d41c532688e957e1), [`354f9ce`](https://github.com/mastra-ai/mastra/commit/354f9ce1ca6af2074b6a196a23f8ec30012dccca), [`16e34ca`](https://github.com/mastra-ai/mastra/commit/16e34caa98b9a114b17a6125e4e3fd87f169d0d0), [`7020c06`](https://github.com/mastra-ai/mastra/commit/7020c0690b199d9da337f0e805f16948e557922e), [`8786a61`](https://github.com/mastra-ai/mastra/commit/8786a61fa54ba265f85eeff9985ca39863d18bb6), [`9467ea8`](https://github.com/mastra-ai/mastra/commit/9467ea87695749a53dfc041576410ebf9ee7bb67), [`7338d94`](https://github.com/mastra-ai/mastra/commit/7338d949380cf68b095342e8e42610dc51d557c1), [`c80dc16`](https://github.com/mastra-ai/mastra/commit/c80dc16e113e6cc159f510ffde501ad4711b2189), [`af8a57e`](https://github.com/mastra-ai/mastra/commit/af8a57ed9ba9685ad8601d5b71ae3706da6222f9), [`d63ffdb`](https://github.com/mastra-ai/mastra/commit/d63ffdbb2c11e76fe5ea45faab44bc15460f010c), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`1bd5104`](https://github.com/mastra-ai/mastra/commit/1bd51048b6da93507276d6623e3fd96a9e1a8944), [`e9837b5`](https://github.com/mastra-ai/mastra/commit/e9837b53699e18711b09e0ca010a4106376f2653), [`8f1b280`](https://github.com/mastra-ai/mastra/commit/8f1b280b7fe6999ec654f160cb69c1a8719e7a57), [`92dcf02`](https://github.com/mastra-ai/mastra/commit/92dcf029294210ac91b090900c1a0555a425c57a), [`0fd90a2`](https://github.com/mastra-ai/mastra/commit/0fd90a215caf5fca8099c15a67ca03e4427747a3), [`8fb2405`](https://github.com/mastra-ai/mastra/commit/8fb2405138f2d208b7962ad03f121ca25bcc28c5), [`12df98c`](https://github.com/mastra-ai/mastra/commit/12df98c4904643d9481f5c78f3bed443725b4c96)]:
  - @mastra/core@1.26.0

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
