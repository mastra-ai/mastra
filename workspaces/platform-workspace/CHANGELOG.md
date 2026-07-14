# @mastra/platform

## 0.1.0-alpha.0

### Minor Changes

- Added Mastra Platform workspace providers for connecting agents to Platform sandboxes and bucket-backed filesystems. ([#18908](https://github.com/mastra-ai/mastra/pull/18908))

  `PlatformFilesystem` and `PlatformSandbox` extend `MastraFilesystem` / `MastraSandbox` from `@mastra/core/workspace` and speak the workspace-proxy wire format (`Authorization: Bearer sk_*`, project-scoped routes at `/v1/projects/:projectId/...`). Both accept config directly and fall back to env vars (`MASTRA_PLATFORM_ACCESS_TOKEN`, `MASTRA_PROJECT_ID`, `MASTRA_ENVIRONMENT_ID`, `MASTRA_PLATFORM_BUCKET_NAME`, `MASTRA_WORKSPACE_PROXY_URL`).

  ```ts
  import { Workspace } from '@mastra/core/workspace';
  import { PlatformFilesystem, PlatformSandbox } from '@mastra/platform-workspace';

  const workspace = new Workspace({
    filesystem: new PlatformFilesystem({ bucketName: 'dev-bucket' }),
    sandbox: new PlatformSandbox({
      environmentId: 'env_123',
      idleTimeoutMinutes: 30,
      networkIsolation: 'ISOLATED',
    }),
  });
  ```

  Also exports `platformFilesystemProvider` and `platformSandboxProvider` descriptors for hosts that register providers dynamically through the editor's `FilesystemProvider` / `SandboxProvider` registries:

  ```ts
  import { platformFilesystemProvider, platformSandboxProvider } from '@mastra/platform-workspace';

  registry.registerFilesystem(platformFilesystemProvider);
  registry.registerSandbox(platformSandboxProvider);
  ```

### Patch Changes

- Updated dependencies [[`45a8e65`](https://github.com/mastra-ai/mastra/commit/45a8e65e1556d1362cb3f25187023c36de26661d), [`c8ed116`](https://github.com/mastra-ai/mastra/commit/c8ed11699f62bcac70102ab4ec84d80d20541da6), [`33f2b88`](https://github.com/mastra-ai/mastra/commit/33f2b88842c09a567f906fac4cb61cd5277ced59)]:
  - @mastra/core@1.51.0-alpha.11

## 0.0.1-alpha.0

### Patch Changes

- Initial Platform workspace providers.
