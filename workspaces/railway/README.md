# @mastra/railway

Railway cloud sandbox provider for [Mastra](https://mastra.ai) workspaces.

Implements the `WorkspaceSandbox` interface using [Railway Sandboxes](https://docs.railway.com/sandboxes) — ephemeral, isolated Linux VMs provisioned on demand through Railway's TypeScript SDK. Supports command execution with streaming output, command timeouts, configurable idle timeout, network isolation, and reattaching to an existing sandbox.

> Railway Sandboxes are available through Priority Boarding and the SDK may change in breaking ways between releases.

## Install

```bash
pnpm add @mastra/railway @mastra/core
```

## Configuration

The provider reads credentials from the environment by default:

| Option          | Environment variable     |
| --------------- | ------------------------ |
| `token`         | `RAILWAY_API_TOKEN`      |
| `environmentId` | `RAILWAY_ENVIRONMENT_ID` |

Pass them explicitly to override the environment values.

## Usage

### Basic

```typescript
import { Workspace } from '@mastra/core/workspace';
import { RailwaySandbox } from '@mastra/railway';

const sandbox = new RailwaySandbox({
  // token + environmentId read from RAILWAY_API_TOKEN / RAILWAY_ENVIRONMENT_ID
  idleTimeoutMinutes: 30,
});

const workspace = new Workspace({ sandbox });
await workspace.init();

const result = await workspace.sandbox.executeCommand('echo', ['Hello!']);
console.log(result.stdout); // "Hello!"

await workspace.destroy();
```

### Private networking

Join the environment's private network to reach other services (for example
`postgres.railway.internal`):

```typescript
const sandbox = new RailwaySandbox({
  networkIsolation: 'PRIVATE',
  env: { NODE_ENV: 'production' },
});
```

### Reattach to an existing sandbox

A Railway sandbox outlives the process that created it. Reconnect by its
Railway ID instead of provisioning a new one:

```typescript
const sandbox = new RailwaySandbox({ sandboxId: 'existing-railway-sandbox-id' });
```

### Custom base image (templates)

Pre-install packages and run setup steps so every sandbox starts ready. Pass a
builder callback over the Railway template builder — Railway builds the image
when the sandbox is created during `start()`:

```typescript
const sandbox = new RailwaySandbox({
  template: t => t.withPackages('git', 'curl').run('npm i -g pnpm').workdir('/app'),
});
```

You can also pass a `SandboxTemplate` to reuse it across sandboxes. Railway
builds the image during sandbox creation. Templates are ignored when
`sandboxId` is set (reattach).

### Fork a running sandbox

Clone a running sandbox's filesystem into a new, independent sandbox (a fresh
boot, not live processes). The returned `RailwaySandbox` is already started:

```typescript
const child = await sandbox.fork({ idleTimeoutMinutes: 15 });
const result = await child.executeCommand('cat', ['/app/state.json']);
```

### Long-running processes

Use the process manager to spawn background commands and stream their output:

```typescript
const handle = await sandbox.processes.spawn('npm run dev', {
  onStdout: chunk => process.stdout.write(chunk),
});

// Later
await handle.kill();
```

## Options

| Option               | Type                                           | Description                                                                                      |
| -------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `token`              | `string`                                       | Railway API token. Falls back to `RAILWAY_API_TOKEN`.                                            |
| `environmentId`      | `string`                                       | Railway environment ID. Falls back to `RAILWAY_ENVIRONMENT_ID`.                                  |
| `sandboxId`          | `string`                                       | Reattach to an existing Railway sandbox by ID instead of creating one.                           |
| `idleTimeoutMinutes` | `number`                                       | Minutes a sandbox can sit idle before Railway destroys it. Range/default depend on the plan.     |
| `networkIsolation`   | `'ISOLATED' \| 'PRIVATE'`                      | Network mode. `ISOLATED` (default) is outbound-only; `PRIVATE` joins the private network.        |
| `env`                | `Record<string, string>`                       | Environment variables baked into the sandbox.                                                    |
| `template`           | `SandboxTemplate \| (base) => SandboxTemplate` | Provision from a custom base image built with the Railway template builder. Ignored on reattach. |
| `timeout`            | `number`                                       | Default command timeout in milliseconds. Commands run until they exit when omitted.              |
| `instructions`       | `string \| (opts) => string`                   | Override the default agent instructions.                                                         |

## Editor provider

Register the provider with `MastraEditor` to hydrate stored sandbox configs:

```typescript
import { railwaySandboxProvider } from '@mastra/railway';

const editor = new MastraEditor({
  sandboxes: { [railwaySandboxProvider.id]: railwaySandboxProvider },
});
```

## License

Apache-2.0
