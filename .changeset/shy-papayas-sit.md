---
'@mastra/platform-workspace': minor
---

Added a `buildEnvRevision` option to `createRepoTemplate()`. `buildEnv` values stay out of the template, so changing them alone never rebuilt it. The revision adds a step ahead of the clone and setup steps, so changing it rebuilds them with the new values. `PlatformFactorySandbox` passes `buildEnv` and `buildEnvRevision` from the sandbox context through to it, merging `buildEnv` over the host's `template.buildEnv`.

```ts
import { createRepoTemplate } from '@mastra/platform-workspace';

const template = createRepoTemplate({
  getRepositoryAccess: async () => ({ cloneUrl: 'https://github.com/acme/app.git' }),
  setupCommand: 'npm ci',
  buildEnv: { NPM_TOKEN: process.env.NPM_TOKEN! },
  buildEnvRevision: 'rev-2',
});
```
