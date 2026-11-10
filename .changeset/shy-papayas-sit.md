---
'@mastra/platform-workspace': minor
---

`PlatformFactorySandbox` now passes a Factory's Build environment variables to template builds. They are merged over the host's `template.buildEnv` and stay out of the serialized template. The new `buildEnvRevision` option on `createRepoTemplate()` adds a revision step ahead of the clone and setup steps, so changing the revision rebuilds them.

```ts
import { createRepoTemplate } from '@mastra/platform-workspace';

const template = createRepoTemplate({
  getRepositoryAccess: async () => ({ cloneUrl: 'https://github.com/acme/app.git' }),
  setupCommand: 'npm ci',
  buildEnv: { NPM_TOKEN: process.env.NPM_TOKEN! },
  buildEnvRevision: 'rev-2',
});
```
