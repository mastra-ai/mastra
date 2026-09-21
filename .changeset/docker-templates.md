---
'@mastra/docker': minor
---

Add a `DockerTemplate` API for preparing reusable, content-addressed baseline images for the local Docker sandbox, with the same builder and repo-template contract as the E2B and platform providers.

Prepare an environment once — a base image plus ordered setup commands, env vars, and package installs — then spawn multiple disposable `DockerSandbox`es from it via the new `template` option. Each sandbox is a fresh container with its own writable layer over the shared read-only image, so their filesystems are independent. The baseline is produced by synthesizing a `Dockerfile` and running `docker build`, so setup is baked into reproducible, cached layers.

```typescript
import { DockerSandbox, DockerTemplate, createDockerRepoTemplate } from '@mastra/docker';

const template = new DockerTemplate({ baseImage: 'node:22-slim' })
  .aptInstall(['git', 'ca-certificates'])
  .runCmd('git clone --depth=1 https://example.com/repo /workspace/app')
  .setWorkdir('/workspace/app')
  .runCmd('npm ci');

// Builds the image on first start() and reuses it afterwards; the sandbox's
// working directory follows the template's setWorkdir().
const a = new DockerSandbox({ template });
const b = new DockerSandbox({ template });

// Repository checkout pinned to the current head of a branch, rebuilt when it moves.
const sandbox = new DockerSandbox({
  template: createDockerRepoTemplate({
    getRepositoryAccess: async () => ({ cloneUrl: 'https://github.com/acme/app.git' }),
    setupCommand: ['npm ci', 'npm run build'],
  }),
});
```

- Immutable, chainable builder methods (`from`, `setWorkdir`, `setEnvs`, `runCmd`, `runWithSecrets`, `aptInstall`, `pipInstall`, `npmInstall`) matching the E2B/platform builders.
- Content-addressed image tag (`mastra-template:<hash>`); `build()` is idempotent and reuses an existing image unless `{ force: true }` is passed. Build failures are returned as `{ status: 'failed' }` and retried on the next attempt.
- `DockerSandbox({ template })` accepts a template or an async template factory resolved once per container-creating `start()`.
- Build-time secrets via `runWithSecrets(command, { secrets, output })`: the step runs in a throwaway build stage forked from the steps before it, secret values are passed by value (`{ secrets }` on the template or `build()`) and delivered through BuildKit secret mounts, and only `output` is copied into the image, so values never land in any layer, history entry, or build-cache metadata, nor in the template identity.
- `createDockerRepoTemplate({ getRepositoryAccess, ref, setupCommand, buildEnv, workingDirectory })` prepares a repository checkout and setup as a template factory, resolving the head of `ref` on each sandbox start and pinning it into the identity. The credential from `getRepositoryAccess` is used only for the head lookup and the clone stage.
