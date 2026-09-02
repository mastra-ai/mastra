# @mastra/platform-workspace

Mastra Platform workspace provider. It gives agents environment-scoped sandbox execution and bucket-backed filesystem access through the Mastra Platform workspace proxy.

## Installation

```bash
npm install @mastra/platform-workspace
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { PlatformFilesystem, PlatformSandbox } from '@mastra/platform-workspace';

const workspace = new Workspace({
  filesystem: new PlatformFilesystem({}),
  sandbox: new PlatformSandbox({
    idleTimeoutMinutes: 30,
    networkIsolation: 'ISOLATED',
  }),
});

const agent = new Agent({
  name: 'code-analyzer',
  model: 'anthropic/claude-sonnet-4-5',
  workspace,
});
```

## Documentation

Both providers authenticate through the workspace proxy with `MASTRA_PLATFORM_ACCESS_TOKEN` and `MASTRA_PROJECT_ID`. `PlatformSandbox` also requires `MASTRA_ENVIRONMENT_ID`; `PlatformFilesystem` requires `MASTRA_PLATFORM_BUCKET_NAME`. Constructor values override environment variables, and `MASTRA_WORKSPACE_PROXY_URL` can point requests at a non-production proxy.

`PlatformFilesystem` implements the Mastra filesystem interface against a Platform bucket. It supports reading, writing, listing, moving, and deleting files, preserves reserved characters in object names, and can be mounted with `readOnly: true` to reject mutations.

`PlatformSandbox` starts or reconnects to an environment-scoped provider sandbox and implements command execution, lifecycle, and networking operations. The provider defaults to E2B and can be changed to Railway through `sandboxProvider` or `SANDBOX_PROVIDER`. Pass an existing `sandboxId` to reattach to a live sandbox, and `actingUserId` to partition and attribute project-token requests to a stable application user.

The exported `Template()` builder creates reusable sandbox images from commands, packages, environment values, repository checkouts, CPU, memory, and working-directory settings. Platform derives a content identity from the serialized template so matching definitions can reuse previous builds. Ephemeral environment values are excluded from that identity and are not persisted into the runtime image.

Proxy failures throw `PlatformApiError`, which includes the HTTP status, parsed machine-readable error code, proxy message, and raw response body. Use these fields to distinguish missing resources, authentication failures, and provider errors.

- [Mastra Platform workspaces](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/platform-workspace/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
