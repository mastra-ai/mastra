---
'@mastra/docker': minor
---

Added `DockerFactorySandbox`, which plugs Docker into Mastra Factory as the sandbox provider. Factory gets one container per session, a repository image it can build ahead of the first session, and user-tunable settings on the environment page. It takes the same options as `DockerSandbox` except `id` and `template`.

```ts
import { DockerFactorySandbox } from '@mastra/docker';

new MastraFactory({
  sandbox: new DockerFactorySandbox({ defaults: { baseImage: 'node:22-slim' } }),
});
```

**Settings:** `baseImage`, the image the repository image builds from, and `owner`, the `user[:group]` that owns the checked-out repositories in it. Unset values fall back to the `defaults` option, then to `node:22-slim` and root.
