# Run Mastra agent tasks in Render Sandboxes

Give an agent a separate environment to execute generated code, inspect files, and run tests. `RenderSandbox` plugs into Mastra's `Workspace` and supplies its built-in shell tool. Your TypeScript application runs on the host and calls the model provider. Commands and project files run in a Render sandbox; tool output returns to the agent and can be sent to the model.

This package is a **local, unpublished integration candidate**. Render maintains the integration. It is prepared as `@mastra/render` in Mastra's workspace, subject to Mastra's review and acceptance. It needs no workflow service. The prepared Mastra catalog and documentation changes have not been submitted or accepted.

Tested with Render SDK 1.2.0 and Mastra core 1.75.0: 71 tests, build, typechecking, live SDK checks, and real Claude Haiku 4.5 and Sonnet 4.6 agent runs pass. The 71-test suite also passes on source-built [official main `918704fd4608`](https://github.com/mastra-ai/mastra/commit/918704fd4608aa4d9d90d4d92c0a3429de2b880a), version 1.76.0-alpha.5. After the networking fix, fresh Haiku runs on released core and Sonnet runs on pinned main pass. Earlier runs cover both models on both cores. Core 1.67.0 has packed-package import and type compatibility checks, including coexistence with Render Workflows. The peer range follows Mastra's provider convention, `>=1.67.0-0 <2.0.0-0`; the tested versions are listed here rather than implying every version was exercised. See [verification evidence](validation/RESULTS.md) for the exact scope and the remaining core cancellation-reporting issue.

## Installation

After Mastra publishes the package, install it with:

```bash
npm install @mastra/render
```

Until then, use the local build and archive instructions below.

## Usage

### How execution works

1. Your host application creates the Workspace, starts a Render sandbox and uploads the task files.
2. The host agent calls the model provider. Model tool calls invoke Mastra's shell tool, which sends commands through `RenderSandbox` to Render.
3. Command output returns to the agent for the next model turn. The host independently verifies the result and downloads the files.
4. The host terminates the sandbox and confirms its final status. Downloaded files remain on the host.

The example uses TypeScript for the client and JavaScript for the code under repair. Its sandbox blocks outbound network access; model requests originate from the host, so they still work.

### Prerequisites

- Node.js 22.13 or newer, npm, and the pnpm version pinned by the Mastra checkout.
- A Render workspace with [Sandboxes access](https://render.com/docs/sandboxes).
- This local Mastra checkout, including `workspaces/render`.
- A funded model account. The example defaults to Anthropic Claude Haiku 4.5.

| Host environment variable | Purpose and source                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RENDER_API_KEY`          | Authenticate public sandbox API requests. Create a key in [Render account settings](https://dashboard.render.com/u/settings#api-keys). It must have access to the selected workspace. |
| `RENDER_WORKSPACE_ID`     | Select the team workspace that owns the sandbox, such as `tea-...`, from the [Render Dashboard](https://dashboard.render.com).                                                        |
| `ANTHROPIC_API_KEY`       | Authenticate the model call from the host. Create it in [Anthropic Console](https://console.anthropic.com/settings/keys).                                                             |
| `MODEL` (optional)        | A Mastra model ID. Defaults to `anthropic/claude-haiku-4-5-20251001`; another model needs its own provider credential.                                                                |

Supply credentials with your existing secret manager or shell environment. A `.env` file is not loaded automatically. Do not put credentials in `create.env`: that explicitly sends values into the sandbox. The integration never forwards the host environment automatically.

### Run the code-repair example

The example starts with a Node.js CSV program that drops the last amount from its sum. A real Mastra agent reads the files, fixes the program, runs its tests, and writes a report. The expected result is `{"total":42,"row_count":3}`.

From the Mastra repository root, install and build the package with its workspace dependencies:

```bash
pnpm install --frozen-lockfile
pnpm turbo build --filter @mastra/render
pnpm --filter @mastra/render test:unit
pnpm --filter @mastra/render example
```

Successful output (abbreviated from the live test; the ID varies):

```text
Sandbox sbx-...: running
Verified report: total=42, row_count=3; 4 original tests passed
Sandbox sbx-...: termination confirmed
```

The first line confirms readiness, the second confirms the task result, and the last confirms cleanup through Render's public API.

The example uses published Mastra and Render dependencies and the built package's public import. It writes the corrected program, report and execution evidence to `validation/latest-artifacts/`. It restores the original tests and input before verification, then attempts termination even if the model or verification fails. Cleanup failure fails the run and retains the sandbox ID in `result.json`. Wanted artifacts are downloaded before termination. Evidence includes the agent response and tool output; treat it as task data if you adapt the example to private files.

The complete runnable source is [examples/code-repair/index.ts](examples/code-repair/index.ts). No clone or npm-publication URL is assumed for this unpublished package. To use another verified model, run `MODEL=anthropic/claude-sonnet-4-6 npm run example`. Each run replaces the default evidence files; set `EVIDENCE_DIR` to a separate directory to retain multiple runs.

### Configure a Workspace

To use the adapter in a separate TypeScript application, build and pack it from `workspaces/render`:

```bash
pnpm build
pnpm pack
```

This creates `mastra-render-0.0.0.tgz`. From your application's directory, install the archive using its absolute path, replacing `/absolute/path/to/mastra` with your checkout path:

```bash
npm install @mastra/core@1.75.0 /absolute/path/to/mastra/workspaces/render/mastra-render-0.0.0.tgz
npm install --save-dev tsx
```

Use an ESM application (`"type": "module"` in `package.json`). With the same host credentials configured, save this as `src/run-task.ts`:

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { RenderSandbox } from '@mastra/render';

const sandbox = new RenderSandbox({
  workingDirectory: '/workspace',
  create: {
    timeoutSeconds: 900,
    networkPolicy: { default: 'deny-all' },
  },
});
const workspace = new Workspace({ sandbox });

try {
  await workspace.init();
  await sandbox.writeFiles([{ path: '/workspace/hello.mjs', content: 'console.log(6 * 7)\n' }]);
  const agent = new Agent({
    id: 'code-runner',
    name: 'Code runner',
    model: 'anthropic/claude-sonnet-4-6',
    instructions: 'Use the workspace shell tool to execute and check code.',
    workspace,
  });
  const result = await agent.generate('Run node hello.mjs and report its output.');
  console.log(result.text);
} finally {
  await workspace.destroy();
}
```

Run `npx tsx src/run-task.ts`. The agent should report `42`. This small example demonstrates registration and command execution; the code-repair example above adds protected tests and independent cleanup confirmation.

`workingDirectory` must already exist when a command executes. `writeFiles` creates parent directories, including `/workspace` in this example. A static workspace is shared by all agent requests using it. Create one provider and workspace for each independent task or tenant. Dynamic Workspace resolvers leave provider cleanup to the caller.

### Commands and files

`executeCommand(command, args, options)` supplies Mastra's shell tool. It returns stdout, stderr, the actual exit code, and confirmed `killed`/`timedOut` flags. Nonzero exits are normal results. Infrastructure failures throw `RenderSandboxError`, retaining the cause, partial output, resource ID and any uncertainty about remote execution. Commands are never automatically retried.

The adapter covers every public method of the [Render Sandbox SDK 1.2.0](https://render.com/docs/sandboxes-sdk-typescript):

| Public SDK capability                                                       | Integration API                                                                                              |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Create with plan, region, lifetime, env, network policy or snapshot ID/name | `new RenderSandbox({ create: { ... } })`, then `start()`                                                     |
| Get current sandbox metadata                                                | `refresh()`; `getInfo()` supplies cached Mastra metadata                                                     |
| List sandboxes with status filters and pagination                           | `listSandboxes(input, waitOptions)`                                                                          |
| List sandbox groups                                                         | `listGroups(input, waitOptions)`                                                                             |
| Execute and stream stdout/stderr/exit events                                | `executeCommand(...)` or native `exec(command, { signal, timeoutMs })`                                       |
| Upload Buffer, Uint8Array, string or Node Readable                          | `upload(path, data, { contentType, signal, timeoutMs })`                                                     |
| Extract tar or gzip uploads                                                 | `upload(directory, archive, { contentType: 'application/x-tar' })` or `'application/gzip'`                   |
| Download bytes with size and content type                                   | `download(path, options)`; `readFile(path)` returns the Buffer                                               |
| Terminate                                                                   | `terminate()` explicitly terminates owned or attached resources; `destroy()` terminates only owned resources |
| Create/get/list/delete snapshots                                            | `snapshots.create/get/list/delete(...)`, preserving all SDK input fields                                     |
| Wait for capture, restore filesystem/runtime snapshots                      | `captureSnapshot(...)`, `snapshots.waitForAvailable(...)`, `restore(...)`                                    |

`sdk` exposes the same public sandbox client for direct use. Provider methods handle lifecycle bookkeeping; direct SDK calls bypass it. Prefer `terminate()` when the provider manages the resource. After direct `sdk.terminate`, dispose of the provider with `destroy()`; `refresh()` is for active resources and the SDK can reject a lookup of a terminated sandbox.

`writeFiles([{ path, content, mode }])` uploads Mastra file inputs, creates parents and applies optional permissions. `uploadFile(localPath, remotePath)` streams a local file. `uploadDirectory(localPath, remoteDirectory)` streams a tar archive and requires a host `tar` executable. `downloadToFile(remotePath, localPath)` downloads through the SDK, then atomically replaces the local destination. Its parent directory must exist.

```typescript
import { createReadStream } from 'node:fs';

await sandbox.upload('/workspace/input.bin', createReadStream('./input.bin'));
await sandbox.uploadDirectory('./project', '/workspace/project');
const artifact = await sandbox.download('/workspace/project/result.json');
console.log(artifact.size, artifact.contentType);
await sandbox.downloadToFile('/workspace/project/result.json', './result.json');
```

The live service currently rejects the gzip content type advertised by SDK 1.2.0. The adapter streams gzip decompression on the host and uploads tar, preserving archive extraction support without buffering the whole archive.

For outbound access to specific destinations, use HTTPS rules:

```typescript
const sandbox = new RenderSandbox({
  create: {
    networkPolicy: {
      type: 'allow-list',
      rules: [{ domain: 'example.com', protocol: 'https' }],
    },
  },
});
```

SDK 1.2.0 sends `allowedDomains`, but the live API requires `rules`. The adapter accepts the current typed format above and translates legacy `{ default: 'allow-list', allowedDomains: [...] }` into HTTPS rules through the same public SDK client. HTTP is blocked, including for an allowed domain. Exact domains do not include subdomains. The adapter never falls back to allow-all. Direct `sdk.create()` bypasses this compatibility mapping. Live checks verify deny-all, explicit allow-all, allowed HTTPS, a denied domain and denied HTTP. See the [operation coverage record](validation/RESULTS.md#operation-coverage-audit) for evidence and test limits.

Creation fields pass through to the SDK, with the networking compatibility mapping below. During Render's current early access, the service uses Oregon and a fixed compute size, so supplying `region` or `plan` does not select different infrastructure. See the [SDK creation reference](https://render.com/docs/sandboxes-sdk-typescript#sandbox-lifecycle) for service constraints.

File transfers have no adapter size ceiling by default. Set `maxFileBytes` when your application needs one. Render's service limits still apply. The SDK buffers downloads in memory, including `downloadToFile`; upload streams are consumed and closed by the adapter. Uploads and archive extraction are not transactional, so a failed operation can leave partial files.

Independent commands and transfers may run concurrently on one instance. Coordinate writes to shared paths and snapshots taken during mutations. Files persist until termination or expiration. Every exec starts a fresh shell; shell exports and `cd` do not persist. Use `cwd`, `workingDirectory` and explicit command `env` values. Literal argv, cwd and env are quoted before calling the SDK's command-string API.

### Snapshots and checkpoints

Capture creates a durable snapshot without disposing of its source. Run the following snippet while `sandbox` is active, inside the Workspace example's `try` block before `workspace.destroy()`. `captureSnapshot` waits until it is available, while `snapshots.create` returns the SDK's initial response. A filesystem snapshot saves writable disk state; a runtime snapshot also saves memory and CPU state and must restore onto the same plan.

```typescript
const saved = await sandbox.captureSnapshot({
  kind: 'filesystem', // or 'runtime'
  name: 'prepared-project',
  // expiresAt: a future ISO 8601 timestamp; omitted uses Render's default
});
const restored = sandbox.restore(saved); // new owned provider; no request yet
try {
  await restored.start();
  console.log(await restored.executeCommand('ls /workspace'));
} finally {
  try {
    await restored.destroy();
  } finally {
    await sandbox.snapshots.delete({
      sandboxGroupId: saved.sandboxGroupId,
      snapshotId: saved.id,
    });
  }
}
```

`restore` carries host client configuration and source creation settings into a new provider, while allowing explicit overrides. It sets the correct plan for runtime snapshots and rejects a conflicting override. You can also restore directly with `create.snapshotId` or `create.snapshotName`.

Mastra's `snapshot()` hook captures a named filesystem checkpoint and updates `lastSnapshot`. The name defaults to the logical provider ID or explicit `checkpointName`. `clone({ checkpointName, seedCheckpointName, env, ... })` selects the latest available named checkpoint, falls back to the seed, then to the configured base image/snapshot. An explicit attachment never restores or creates a replacement. Render has no native idle-timeout or acting-user setting, so those clone options are rejected.

Snapshots outlive provider disposal and are not implicitly deleted by `destroy()`. Delete them explicitly or set an expiry. Failed/unfinished capture errors retain snapshot IDs when known. `snapshots.createdSnapshots` records every returned creation receipt, including late responses after caller timeouts; `pendingCreates` lets cleanup wait for outstanding responses. A disconnected create request can still have an unknown outcome. List snapshots in the source sandbox group before attempting another capture.

### Ownership and cancellation

A provider without `sandboxId` owns its created resource. `stop()` and `destroy()` dispose of it because Render SDK 1.2.0 has no pause operation. Capture a snapshot or download wanted files first. An attached provider never creates a replacement; its `destroy()` detaches while preserving the caller-owned sandbox. `terminate()` is an explicit destructive operation for either ownership mode.

```typescript
const attached = new RenderSandbox({ sandboxId: 'sbx-existing' });
try {
  await attached.start();
  await attached.executeCommand('run-task', [], { timeout: 30_000 });
} finally {
  await attached.destroy(); // Cancels this provider's controlled commands, then detaches.
}
```

The default `cancellationMode: 'command'` uses a supervisor inside the sandbox. On abort or timeout it stops the command's process group, verifies termination, and preserves the sandbox and unrelated commands. A token-authenticated control socket and retained process identity avoid signaling an unrelated reused PID. Returned exit codes come from Render's final event. This path requires Linux, Python 3, bash and `/proc`, available in the tested Render base image. A modified snapshot must retain them.

Process groups cover ordinary descendants, not a deliberately detached process that starts another session. Use a dedicated owned sandbox and `cancellationMode: 'terminate'` when cancellation must dispose of the entire environment. In that mode command infrastructure failures, timeouts and aborts destroy an owned sandbox; attached commands only stop observation and reject explicit kill timeouts.

`cancellationMode: 'observe'` keeps the SDK's observation-only behavior and leaves the provider reusable. The native `exec()` event iterator always has observation-only cancellation, regardless of mode. Closing its iterator or aborting its signal does not claim remote termination.

If command termination cannot be confirmed, the adapter throws with `details.remoteMayBeRunning: true`; it never fabricates `killed: true`. The separate [Mastra issue #26580](https://github.com/mastra-ai/mastra/issues/26580) remains relevant: core 1.75.0 and tested main can prepend a false “killed” statement to an aborted tool error. Successful confirmed cancellation works with those versions. The proposed generic core correction is documented in [UPSTREAM.md](docs/UPSTREAM.md).

### Bounds and configuration

| Option                                  | Default and meaning                                                                                                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id` / `sandboxId`                      | Logical provider ID / existing Render resource ID. Setting `sandboxId` attaches without ownership and cannot be combined with `create`.                                                  |
| `ownerId`                               | Workspace for all operations; defaults to `create.ownerId`, then the SDK client or environment. Explicit creation and operation owners must match.                                       |
| `workingDirectory`                      | `/`. Absolute remote directory; create it before executing commands there.                                                                                                               |
| `checkpointName`                        | Logical provider ID. Default name used by the Mastra `snapshot()` hook.                                                                                                                  |
| `client` / `clientOptions`              | Share a host Render instance or its public constructor options, never both. SDK environment fallback remains supported.                                                                  |
| `create`                                | `RenderSandboxCreateInput` preserves the public SDK creation fields and adds current network rules. Default lifetime: 900 seconds; default egress: deny-all.                             |
| `readyTimeoutMs` / `pollIntervalMs`     | 120,000 / 1,000 ms for shared provisioning and readiness. Aborting one readiness waiter does not cancel another caller's provisioning.                                                   |
| `commandTimeoutMs` / `controlTimeoutMs` | 60,000 / 30,000 ms. Per-call overrides are available.                                                                                                                                    |
| `snapshotTimeoutMs`                     | 120,000 ms for capture readiness.                                                                                                                                                        |
| `maxOutputBytes`                        | 1 MiB per returned stream; configurable up to 16 MiB. Retains the UTF-8 tail and reports dropped bytes. Callbacks receive full chunks; native `exec()` streams events without retention. |
| `maxFileBytes`                          | Infinity. An optional positive limit applies to uploads/downloads. Concurrent growth means download prechecks are not a hard memory bound.                                               |
| `cancellationMode`                      | `command`; alternatives are `observe` and `terminate`.                                                                                                                                   |

Creation and other SDK control-plane methods do not accept AbortSignal. The adapter bounds caller waits, retains late creation IDs, and attempts late owned-resource cleanup. It never retries uncertain provisioning. A finite server lifetime is a backstop, not cleanup confirmation. Retain the sandbox ID and retry failed `destroy()` calls. Confirm termination through the public list API, including terminated statuses, as the example does.

This package provides the Workspace sandbox and checkpoint interfaces, not `WorkspaceFilesystem`, mounts, an interactive background process manager, stdin, public preview URLs or code-mode transport. The current Render SDK has no native methods for those facilities. Agent file work uses shell commands; SDK file transfers and snapshots are exposed directly as described above.

### Verification

From the package directory, run `pnpm test:unit`, `pnpm typecheck`, `pnpm lint` and `pnpm build` for local checks. `pnpm test:package` verifies the packed ESM and CommonJS exports and TypeScript consumer compatibility. The shared workspace CI automatically discovers this package. `pnpm test:cloud` runs the live SDK smoke test when both Render credentials are set; otherwise Vitest reports it as skipped. With host Render credentials configured, `npm run test:production-live` checks real cancellation, concurrent work, large transfers, archive extraction, metadata and filesystem/runtime restoration, then deletes its test snapshots and sandboxes. `npm run example` runs the real agent repair task. Evidence and compatibility results are in [validation/RESULTS.md](validation/RESULTS.md).

### Render Workflows

Sandboxes supply the environment in which an agent executes commands. Render Workflows orchestrates durable tasks. They can be composed by creating and cleaning up a sandbox inside an existing task, after accounting for workflow retries potentially repeating agent work. This package imports no Workflows integration or worker transport. Both integrations pin `@renderinc/sdk` 1.2.0 and accept compatible host Render client configuration; the SDK already owns authentication fallback, so no shared helper is needed.

The existing `@renderinc/mastra` Workflows package is private and its upstream PR remains under review. It is never a prerequisite for this example. See [research and API decisions](docs/RESEARCH.md) and [verification evidence](validation/RESULTS.md).

## Documentation

Read the [Render integration guide](https://mastra.ai/integrations/sandboxes/render) for agent setup and lifecycle details. This route is prepared locally and becomes public only after the documentation change is accepted. The [upstream handoff](docs/UPSTREAM.md) records submission and verification status.

## Changelog

Release history will appear in the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/render/CHANGELOG.md).

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
