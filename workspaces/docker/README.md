# @mastra/docker

Docker container sandbox provider for Mastra workspaces. Uses long-lived containers with `docker exec` for command execution. Targets local development, CI/CD, air-gapped deployments, and cost-sensitive scenarios where cloud sandboxes are unnecessary.

## Installation

```bash
npm install @mastra/docker
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { DockerSandbox } from '@mastra/docker';

const workspace = new Workspace({
  sandbox: new DockerSandbox({
    image: 'node:22-slim',
    timeout: 60_000, // 60 second timeout (default: 5 minutes)
  }),
});

const agent = new Agent({
  name: 'my-agent',
  model: 'anthropic/claude-opus-4-6',
  workspace,
});
```

### Volume subpath mounts

Use `mounts` (mapped 1:1 onto Docker's `HostConfig.Mounts`) when you need mount
options that the `-v`/`volumes` syntax cannot express — most notably mounting a
subdirectory of a named volume. Requires Docker Engine 26.0+ (API v1.45+) for
`subpath`.

```typescript
const workspace = new Workspace({
  sandbox: new DockerSandbox({
    image: 'node:22-slim',
    mounts: [
      // Read-only parent from a named volume
      { type: 'volume', source: 'project-data', target: '/shared', readOnly: true },
      // Writable per-conversation subdirectory of the same volume
      {
        type: 'volume',
        source: 'project-data',
        target: '/work',
        volumeOptions: { subpath: 'conversations/abc123' },
      },
    ],
  }),
});
```

`volumes` and `mounts` can be combined; both are passed through to Docker.

> **Note:** Docker does not create `volumeOptions.subpath` for you — the
> subdirectory must already exist inside the named volume before the container
> starts, otherwise the mount fails. Provision it ahead of time (for example,
> with a one-off container that creates `conversations/abc123` in the volume).

### Templates

`DockerTemplate` prepares a reusable environment once — a base image plus ordered
setup commands, env vars, and package installs — then spawns multiple disposable
sandboxes from it. Each sandbox is a fresh container with its own writable layer
over the shared read-only image, so their filesystems are independent. The image
is produced by synthesizing a `Dockerfile` and running `docker build` (not
`docker commit`), so setup is baked into reproducible, cached, content-addressed
layers.

```typescript
import { DockerSandbox, DockerTemplate } from '@mastra/docker';

const template = new DockerTemplate({ baseImage: 'node:22-slim' })
  .aptInstall(['git', 'ca-certificates'])
  .runCmd('git clone --depth=1 https://example.com/repo /workspace/app')
  .setWorkdir('/workspace/app')
  .runCmd('npm ci');

// Prepare once, spawn many — each has an independent writable filesystem.
// The sandbox builds the image on first start() and reuses it afterwards,
// and its working directory follows the template's last setWorkdir().
const a = new DockerSandbox({ template });
const b = new DockerSandbox({ template });

// Or build explicitly, e.g. to surface failures before creating sandboxes.
const result = await template.build();
if (result.status !== 'ready') throw new Error(result.error);

// Cancel repository resolution or template preparation when needed.
const controller = new AbortController();
await a.start({ abortSignal: controller.signal });
// Explicit builds accept the same option: template.build({ abortSignal: controller.signal }).

// Remove the built image when done (independent of any sandbox's destroy()).
await template.dispose();
```

`template` also accepts an async factory (`() => Promise<DockerTemplate>`),
resolved once per container-creating `start()`; this is how repository
templates track a moving branch.

Builder methods (`from`, `setWorkdir`, `setEnvs`, `runCmd`, `aptInstall`,
`pipInstall`, `npmInstall`) are immutable and chainable — each returns a new
template, and their signatures match the E2B and platform template builders.
The image tag is content-addressed (`mastra-template:<hash>`), so `build()` is
idempotent and reuses an existing image unless you pass `{ force: true }`,
which also bypasses the daemon's layer cache so every step really re-runs.
Concurrent callers share preparation work, but each caller can cancel its own
wait independently; the underlying build is cancelled only after its last
active caller aborts.

Never put secrets in `setEnvs` — they are baked into the image. For a step that
needs a credential, use `runWithSecrets`: the command runs in a throwaway build
stage forked from the steps before it, and only `output` is copied into the
image. Secret values are passed by value (`new DockerTemplate({ secrets })` or
`build({ secrets })`, falling back to `process.env`) and never enter the template
identity. Values are delivered through BuildKit secret mounts, so they never
land in any layer, history entry, or build-cache metadata — only in a tmpfs
visible to that one `RUN`. Builds that use secrets require a BuildKit-capable
daemon (Docker 20.10+).

```typescript
const template = new DockerTemplate({ secrets: { GITHUB_TOKEN: token } })
  .aptInstall(['git', 'ca-certificates'])
  .runWithSecrets(
    'git -c http.extraheader="AUTHORIZATION: bearer $GITHUB_TOKEN" clone https://github.com/acme/private.git /workspace/app',
    {
      secrets: ['GITHUB_TOKEN'],
      output: '/workspace/app',
    },
  )
  .setWorkdir('/workspace/app')
  .runCmd('npm ci');
```

`dispose()` removes the image; Docker refuses while a container still references
it, so destroy the template's sandboxes first.

#### Repository templates

`createDockerRepoTemplate` prepares a repository checkout plus setup commands,
with the same options as the E2B and platform repo templates. It returns a
template factory for the sandbox's `template` option: on each resolution it
calls `getRepositoryAccess`, resolves the current head of `ref` (default
branch when omitted) with `git ls-remote`, and pins that commit into the
template identity — so a moved branch yields a fresh image for the next sandbox
while an unmoved one reuses the cached image. The credential is used only for
the head lookup and the clone stage; it never enters the identity or the image.

```typescript
import { DockerSandbox, createDockerRepoTemplate } from '@mastra/docker';

const sandbox = new DockerSandbox({
  template: createDockerRepoTemplate({
    getRepositoryAccess: async () => ({
      cloneUrl: 'https://github.com/acme/app.git',
      authorization: { scheme: 'bearer', token: await mintInstallationToken() }, // private repos
    }),
    ref: 'main', // branch, tag, or commit; omit for the default branch
    setupCommand: ['npm ci', 'npm run build'],
    buildEnv: { NPM_CONFIG_REGISTRY: 'https://registry.example.com' }, // non-secret, part of the identity
    workingDirectory: '/workspace', // checkout lands at /workspace/app and becomes the cwd
  }),
});
```

## Documentation

- [Docker Sandbox integration guide](https://mastra.ai/integrations/sandboxes/docker)
- [Workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/docker/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
