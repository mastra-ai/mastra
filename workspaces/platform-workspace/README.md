# @mastra/platform-workspace

Mastra Platform workspace provider. Gives agents environment-scoped sandbox execution and bucket-backed filesystem access through the Mastra Platform workspace proxy.

## Installation

```bash
npm install @mastra/platform-workspace
```

## Configuration

All options can be passed to the constructor or read from environment variables:

| Option          | Env var                        | Required         |
| --------------- | ------------------------------ | ---------------- |
| `accessToken`   | `MASTRA_PLATFORM_SECRET_KEY`   | Yes              |
| `projectId`     | `MASTRA_PROJECT_ID`            | Yes              |
| `environmentId` | `MASTRA_ENVIRONMENT_ID`        | Yes (sandbox)    |
| `bucketName`    | `MASTRA_PLATFORM_BUCKET_NAME`  | Yes (filesystem) |

`MASTRA_PLATFORM_ACCESS_TOKEN` is still read as a deprecated fallback for `accessToken`.

The proxy URL defaults to `https://workspaces.mastra.ai` and can be overridden with the `MASTRA_WORKSPACE_PROXY_URL` env var (useful for staging).

Requests to the proxy are authenticated with `Authorization: Bearer <accessToken>`.

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { PlatformFilesystem, PlatformSandbox } from '@mastra/platform-workspace';

const workspace = new Workspace({
  filesystem: new PlatformFilesystem({
    // accessToken, projectId, bucketName all fall back to env
  }),
  sandbox: new PlatformSandbox({
    // accessToken, projectId, environmentId all fall back to env
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

## Filesystem

`PlatformFilesystem` implements the Mastra filesystem interface against a workspace bucket. Object keys are percent-encoded per segment, so filenames with `?`, `#`, `%`, `&`, `+`, or spaces are preserved end-to-end.

```typescript
const fs = new PlatformFilesystem({ bucketName: 'reports' });

await fs.writeFile('/analyses/repo.md', markdown);
const content = await fs.readFile('/analyses/repo.md');
const entries = await fs.readdir('/analyses');
await fs.moveFile('/analyses/repo.md', '/analyses/repo-final.md');
```

Pass `readOnly: true` to mount the bucket read-only. Mutating calls will throw `WorkspaceReadOnlyError`.

## Sandbox

`PlatformSandbox` executes commands inside a Railway-backed sandbox tied to a Platform environment. Sessions boot from a pre-built recipe checkpoint (Python 3, Node 22, TypeScript/tsx, common build tooling).

```typescript
const sandbox = new PlatformSandbox({ environmentId: 'env_abc' });

const result = await sandbox.executeCommand('python', ['analyze.py'], {
  timeout: 30_000,
  env: { INPUT: 'repo' },
});

console.log(result.stdout);
```

Pass an existing `sandboxId` to reattach to a live sandbox instead of creating a new one.

## Errors

Failures from the proxy raise `PlatformApiError`. Structured `{ error: { message, type } }` payloads from the proxy are parsed into `.code` (machine kind) and `.proxyMessage` (human string); the raw response body stays available on `.body`:

```typescript
import { PlatformApiError } from '@mastra/platform-workspace';

try {
  await fs.readFile('/missing.txt');
} catch (err) {
  if (err instanceof PlatformApiError) {
    if (err.code === 'not_found') {
      // handle missing file
    } else if (err.code === 'authentication_error') {
      // refresh token
    }
    console.error(err.status, err.code, err.proxyMessage, err.body);
  }
}
```

`code` / `proxyMessage` are `undefined` when the proxy returns a non-JSON body (e.g. an HTML 502 from a load balancer).

Filesystem-specific errors (`FileNotFoundError`, `FileExistsError`, `WorkspaceReadOnlyError`) are re-exported from `@mastra/core`.
