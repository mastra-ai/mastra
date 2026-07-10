---
'@mastra/platform': minor
---

Added Mastra Platform workspace providers for connecting agents to Platform sandboxes and bucket-backed filesystems.

`PlatformFilesystem` and `PlatformSandbox` extend `MastraFilesystem` / `MastraSandbox` from `@mastra/core/workspace` and speak the workspace-proxy wire format (`Authorization: Bearer sk_*`, project-scoped routes at `/v1/projects/:projectId/...`). Both accept config directly and fall back to env vars (`MASTRA_PLATFORM_ACCESS_TOKEN`, `MASTRA_PROJECT_ID`, `MASTRA_ENVIRONMENT_ID`, `MASTRA_PLATFORM_BUCKET_NAME`, `MASTRA_WORKSPACE_PROXY_URL`).

```ts
import { Workspace } from '@mastra/core/workspace';
import { PlatformFilesystem, PlatformSandbox } from '@mastra/platform';

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
import { platformFilesystemProvider, platformSandboxProvider } from '@mastra/platform';

registry.registerFilesystem(platformFilesystemProvider);
registry.registerSandbox(platformSandboxProvider);
```
