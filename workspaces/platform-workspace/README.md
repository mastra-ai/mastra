# @mastra/platform-workspace

Mastra Platform workspace provider. It gives agents environment-scoped sandbox execution and bucket-backed filesystem access through the Mastra Platform workspace proxy.

## Installation

```bash
npm install @mastra/platform-workspace
```

## Configuration

All options can be passed to the constructor or read from environment variables:

| Option          | Env var                        | Required         |
| --------------- | ------------------------------ | ---------------- |
| `accessToken`   | `MASTRA_PLATFORM_ACCESS_TOKEN` | Yes              |
| `projectId`     | `MASTRA_PROJECT_ID`            | Yes              |
| `environmentId` | `MASTRA_ENVIRONMENT_ID`        | Yes (sandbox)    |
| `actingUserId`  | —                              | No (sandbox)     |
| `bucketName`    | `MASTRA_PLATFORM_BUCKET_NAME`  | Yes (filesystem) |

The proxy URL defaults to `https://workspaces.mastra.ai`. Set `MASTRA_PLATFORM_REGION` to `us` or `eu` (case-insensitive) to route to the regional replica at `https://workspaces.us.mastra.ai` or `https://workspaces.eu.mastra.ai`. An explicit `MASTRA_WORKSPACE_PROXY_URL` (useful for staging) overrides both.

Requests to the proxy are authenticated with `Authorization: Bearer <accessToken>`. For sandbox requests authenticated with a project access token, set `actingUserId` to the stable opaque user subject from your authentication system. It is sent as `x-acting-user-id` for token partitioning and attribution; it is not an authorization claim.


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
