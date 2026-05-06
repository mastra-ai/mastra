# @mastra/agentfs

## 0.1.0

### Minor Changes

- Added AgentFSFilesystem workspace provider — a Turso/SQLite-backed filesystem via the agentfs-sdk that gives agents persistent, database-backed file storage across sessions. ([#13450](https://github.com/mastra-ai/mastra/pull/13450))

  **Basic usage**

  ```ts
  import { Workspace } from '@mastra/core/workspace';
  import { AgentFSFilesystem } from '@mastra/agentfs';

  const workspace = new Workspace({
    filesystem: new AgentFSFilesystem({
      agentId: 'my-agent',
    }),
  });
  ```

### Patch Changes

- Updated dependencies [[`ea86967`](https://github.com/mastra-ai/mastra/commit/ea86967449426e0a3673253bd1c2c052a99d970d), [`db21c21`](https://github.com/mastra-ai/mastra/commit/db21c21a6ae5f33539262cc535342fa8757eb359), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`6751354`](https://github.com/mastra-ai/mastra/commit/67513544d1a64be891d9de7624d40aadc895d56e), [`c958cd3`](https://github.com/mastra-ai/mastra/commit/c958cd36627c1eea122ec241b2b15492977a263a), [`86f2426`](https://github.com/mastra-ai/mastra/commit/86f242631d252a172d2f9f9a2ea0feb8647a76b0), [`950eb07`](https://github.com/mastra-ai/mastra/commit/950eb07b7e7354629630e218d49550fdd299c452)]:
  - @mastra/core@1.13.0

## 0.1.0-alpha.0

### Minor Changes

- Added AgentFSFilesystem workspace provider — a Turso/SQLite-backed filesystem via the agentfs-sdk that gives agents persistent, database-backed file storage across sessions. ([#13450](https://github.com/mastra-ai/mastra/pull/13450))

  **Basic usage**

  ```ts
  import { Workspace } from '@mastra/core/workspace';
  import { AgentFSFilesystem } from '@mastra/agentfs';

  const workspace = new Workspace({
    filesystem: new AgentFSFilesystem({
      agentId: 'my-agent',
    }),
  });
  ```

### Patch Changes

- Updated dependencies [[`ea86967`](https://github.com/mastra-ai/mastra/commit/ea86967449426e0a3673253bd1c2c052a99d970d), [`db21c21`](https://github.com/mastra-ai/mastra/commit/db21c21a6ae5f33539262cc535342fa8757eb359), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`6751354`](https://github.com/mastra-ai/mastra/commit/67513544d1a64be891d9de7624d40aadc895d56e), [`c958cd3`](https://github.com/mastra-ai/mastra/commit/c958cd36627c1eea122ec241b2b15492977a263a), [`86f2426`](https://github.com/mastra-ai/mastra/commit/86f242631d252a172d2f9f9a2ea0feb8647a76b0), [`950eb07`](https://github.com/mastra-ai/mastra/commit/950eb07b7e7354629630e218d49550fdd299c452)]:
  - @mastra/core@1.13.0-alpha.0
