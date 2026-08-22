# @mastra/platform-workspace

Mastra Platform workspace provider. Gives agents environment-scoped sandbox execution and bucket-backed filesystem access through the Mastra Platform workspace proxy.

## Installation

```bash
npm install @mastra/platform-workspace
```

## Configuration

All options can be passed to the constructor or read from environment variables:

| Option            | Env var                        | Required         |
| ----------------- | ------------------------------ | ---------------- |
| `accessToken`     | `MASTRA_PLATFORM_ACCESS_TOKEN` | Yes              |
| `projectId`       | `MASTRA_PROJECT_ID`            | Yes              |
| `environmentId`   | `MASTRA_ENVIRONMENT_ID`        | Yes (sandbox)    |
| `actingUserId`    | —                              | No (sandbox)     |
| `sandboxProvider` | `SANDBOX_PROVIDER`             | No (sandbox)     |
| `bucketName`      | `MASTRA_PLATFORM_BUCKET_NAME`  | Yes (filesystem) |

The sandbox provider resolves from the explicit `sandboxProvider` option, then `SANDBOX_PROVIDER`, then defaults to `railway`. The proxy URL defaults to `https://workspaces.mastra.ai` and can be overridden with the `MASTRA_WORKSPACE_PROXY_URL` env var (useful for staging).

Requests to the proxy are authenticated with `Authorization: Bearer <accessToken>`. For sandbox requests authenticated with a project access token, set `actingUserId` to the stable opaque user subject from your authentication system. It is sent as `x-acting-user-id` for token partitioning and attribution; it is not an authorization claim.

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

`PlatformSandbox` executes commands inside a provider-backed sandbox tied to a Platform environment. Sessions boot from the configured provider template or checkpoint.

```typescript
const sandbox = new PlatformSandbox({ environmentId: 'env_abc' });

const result = await sandbox.executeCommand('python', ['analyze.py'], {
  timeout: 30_000,
  env: { INPUT: 'repo' },
});

console.log(result.stdout);
```

Pass an existing `sandboxId` to reattach to a live sandbox instead of creating a new one.

### Reusable templates

Use `Template()` to prebuild a public repository at an immutable commit. `PlatformSandbox` derives a deterministic template ID, starts or reuses the provider build, and retries sandbox creation while the build is pending:

```typescript
import { PlatformSandbox, Template } from '@mastra/platform-workspace';

const commitSha = process.env.REPOSITORY_COMMIT_SHA!;
const template = Template()
  .setWorkdir('/workspace/repo')
  .setEnvs({ BUILD_CONFIG_MARKER: 'template-v1' })
  .aptInstall(['git', 'jq'])
  .runCmd('git clone https://github.com/mastra-ai/mastra.git /workspace/repo')
  .runCmd(`git checkout ${commitSha}`)
  .runCmd('pnpm install --frozen-lockfile');

const sandbox = new PlatformSandbox({
  environmentId: 'env_abc',
  sandboxProvider: 'e2b',
  template,
});
await sandbox.start();
```

Platform serializes the builder and stores the build state under its deterministic ID within the authenticated organization, project, environment, and selected provider. Passing the same definition to another sandbox reuses that build.

All operation arguments are serialized and sent to the provider. Values passed to `setEnvs` must contain only non-sensitive build configuration. Credentials, private-repository tokens, and other secrets aren't supported in template definitions.

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

### Sandbox exec errors

`PlatformSandbox.executeCommand` runs over the direct-exec data plane (a WebSocket straight to the Railway tcp-proxy) and can throw two typed errors on unrecoverable failure:

- `SandboxDestroyedError` — the platform returned 410 for `/exec-lease`, meaning the sandbox has been destroyed. The cached sandbox id and lease are cleared, so a reused `PlatformSandbox` instance will re-provision on the next call. Fleet-level code that owns a binding store should catch this, clear the stale sandbox id, and reprovision + replay.
- `SandboxExecTransportError` — both the initial WebSocket attempt and the built-in retry closed without an `exit` frame against a live sandbox. Carries `{ opened, closeCode, closeReason, wsEndpoint }` diagnostics plus `sandboxId`, `command`, and `attempts` so upstream logs / alerts can distinguish "the Railway data plane is broken" from "your command failed".

`PlatformApiError` (with status 404 / 500 / 501 on `/exec-lease`) can also bubble up from `executeCommand` — those are configuration or platform errors, not "reprovision me" signals, and are propagated as-is.
