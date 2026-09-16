---
'@mastra/docker': minor
---

Add a `DockerTemplate` API for preparing reusable, content-addressed baseline images for the local Docker sandbox.

Prepare an environment once — a base image plus ordered setup commands, env vars, and package installs — then spawn multiple disposable `DockerSandbox`es from it. Each sandbox is a fresh container with its own writable layer over the shared read-only image, so their filesystems are independent. The baseline is produced by synthesizing a `Dockerfile` and running `docker build` (not `docker commit`), so setup is baked into reproducible, cached layers.

```typescript
import { DockerTemplate } from '@mastra/docker';

const template = new DockerTemplate({ baseImage: 'node:22-slim' })
  .runCmd('git clone --depth=1 https://example.com/repo /workspace/app')
  .setWorkdir('/workspace/app')
  .runCmd('npm ci');

const result = await template.build();
if (result.status !== 'ready') throw new Error(result.error);

const a = await template.createSandbox(); // independent writable filesystem
const b = await template.createSandbox();

await template.dispose(); // remove the built image when done
```

- Immutable, chainable builder methods (`from`, `setWorkdir`, `setEnvs`, `runCmd`, `runWithSecrets`, `aptInstall`, `npmInstall`).
- Content-addressed image tag (`mastra-template:<hash>`); `build()` is idempotent and reuses an existing image unless `{ force: true }` is passed.
- Build-time secrets via `runWithSecrets(command, { secrets, output })` — the step runs in a throwaway build stage, the named variables are read from `process.env` at `build()` time, and only `output` is copied into the image, so secret values never land in the image's layers, config, or history.
- `createDockerRepoTemplate` convenience for preparing a repository checkout at an exact commit (or branch) plus setup commands, with an optional private-repo token read from a named environment variable and handled the same way.
