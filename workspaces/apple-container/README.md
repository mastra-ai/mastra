# @mastra/apple-container

Apple container CLI sandbox provider for [Mastra](https://mastra.ai) workspaces.

Implements the `WorkspaceSandbox` interface with Apple's [`container`](https://github.com/apple/container) CLI. The provider starts a long-lived OCI Linux container and runs workspace commands through `container exec`.

## Install

```bash
pnpm add @mastra/apple-container @mastra/core
```

Requires Apple silicon, macOS 26 or newer, and the Apple `container` CLI. Start Apple's container system before using the provider:

```bash
container system start
```

## Usage

```typescript
import { Workspace } from '@mastra/core/workspace';
import { AppleContainerSandbox } from '@mastra/apple-container';

const sandbox = new AppleContainerSandbox({
  image: 'node:22-slim',
  volumes: {
    '/Users/me/project': '/workspace',
  },
  workingDir: '/workspace',
});

const workspace = new Workspace({ sandbox });
await workspace.init();

const result = await workspace.sandbox?.executeCommand?.('node', ['--version']);
console.log(result?.stdout);

await workspace.destroy();
```

## Options

| Option             | Type                         | Description                                                        |
| ------------------ | ---------------------------- | ------------------------------------------------------------------ |
| `id`               | `string`                     | Unique sandbox ID.                                                 |
| `name`             | `string`                     | Apple container name. Defaults to the sandbox ID.                  |
| `image`            | `string`                     | OCI image to run. Defaults to `node:22-slim`.                      |
| `command`          | `string[]`                   | Container init command. Defaults to `['sleep', 'infinity']`.       |
| `env`              | `Record<string, string>`     | Environment variables applied to the container and command execs.  |
| `volumes`          | `Record<string, string>`     | Host-to-container bind mounts.                                     |
| `mounts`           | `string[]`                   | Raw `--mount` specs passed to `container run`.                     |
| `network`          | `string`                     | Apple container network attachment spec.                           |
| `publishedPorts`   | `string[]`                   | Port publish specs passed as `--publish`.                          |
| `publishedSockets` | `string[]`                   | Socket publish specs passed as `--publish-socket`.                 |
| `cpus`             | `number \| string`           | Number of CPUs allocated to the container.                         |
| `memory`           | `string`                     | Memory allocation, for example `1G`.                               |
| `platform`         | `string`                     | OCI platform, for example `linux/arm64`.                           |
| `arch`             | `string`                     | Image architecture when selecting multi-arch images.               |
| `os`               | `string`                     | Operating system when selecting multi-platform images.             |
| `rosetta`          | `boolean`                    | Enable Rosetta in the container.                                   |
| `readonlyRootfs`   | `boolean`                    | Start the container with a read-only root filesystem.              |
| `ssh`              | `boolean`                    | Forward the host SSH agent socket.                                 |
| `init`             | `boolean`                    | Enable Apple's init process in the container.                      |
| `virtualization`   | `boolean`                    | Expose virtualization capabilities to the container.               |
| `capAdd`           | `string[]`                   | Linux capabilities to add.                                         |
| `capDrop`          | `string[]`                   | Linux capabilities to drop.                                        |
| `tmpfs`            | `string[]`                   | tmpfs destination paths, for example `/tmp`.                       |
| `dns`              | `string[]`                   | DNS nameserver IPs.                                                |
| `dnsSearch`        | `string[]`                   | DNS search domains.                                                |
| `noDns`            | `boolean`                    | Do not configure DNS in the container.                             |
| `labels`           | `Record<string, string>`     | Container labels. Mastra labels are always added.                  |
| `workingDir`       | `string`                     | Working directory inside the container. Defaults to `/workspace`.  |
| `timeout`          | `number`                     | Default command timeout in milliseconds.                           |
| `deleteOnDestroy`  | `boolean`                    | Delete the Apple container on destroy. Defaults to `true`.         |
| `containerBinary`  | `string`                     | Path or name for the Apple container CLI. Defaults to `container`. |
| `onStart`          | `({ sandbox }) => unknown`   | Lifecycle hook called after the sandbox reaches `running`.         |
| `onStop`           | `({ sandbox }) => unknown`   | Lifecycle hook called before the sandbox stops.                    |
| `onDestroy`        | `({ sandbox }) => unknown`   | Lifecycle hook called before the sandbox is destroyed.             |
| `instructions`     | `string \| (opts) => string` | Override or extend the default workspace sandbox instructions.     |

Apple `--tmpfs` accepts container paths only, such as `/tmp`; it does not accept Docker-style option specs like `/tmp:rw,size=256m`.
When `readonlyRootfs` is enabled, make sure `workingDir` points to a path supplied by the image, a bind mount, or a writable tmpfs.

## Security model

This provider runs local containers through the host Apple `container` service. Treat constructor options as trusted server-side configuration:

- `volumes`, `mounts`, and `publishedSockets` can expose host paths to containerized code.
- `publishedPorts` can expose in-container services on the host or network; bind to `127.0.0.1` when only local access is intended.
- `ssh` forwards the host SSH agent socket.
- `capAdd` and `virtualization` can expand what containerized code can do.
- `containerBinary` is intentionally a constructor-only escape hatch for trusted code and is not part of the serializable editor provider schema.

Use the narrowest mounts and capabilities your workload needs. Existing containers are only reconnected when they carry Mastra ownership labels for the sandbox ID. Containers created by this provider also include a config-hash label; when that label is present, reconnect fails if immutable runtime options such as image, command, mounts, ports, capabilities, or working directory changed.

## Limitations

`AppleContainerSandbox` implements foreground workspace command execution with `executeCommand()`. It does not yet expose a `SandboxProcessManager` for background processes or LSP sessions.

Command timeouts are enforced inside the container so timed-out commands are cleaned up by the container runtime. Abort signals cancel the host CLI wait path and should not be used as a substitute for command timeouts when in-container cleanup matters.

## Editor provider

Register the provider with `MastraEditor` to hydrate stored sandbox configs:

```typescript
import { MastraEditor } from '@mastra/editor';
import { appleContainerSandboxProvider } from '@mastra/apple-container';

const editor = new MastraEditor({
  sandboxes: { [appleContainerSandboxProvider.id]: appleContainerSandboxProvider },
});
```

## License

Apache-2.0
