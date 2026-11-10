---
'@mastra/e2b': minor
---

`E2BFactorySandbox` now passes a Factory's Build environment variables to template builds. `createRepoTemplate()` accepts `buildStepEnv`, which reaches the build steps like the clone credential without entering the template name, and `buildEnvRevision`, which names the template instead. Change the revision whenever the values change to build a new template.

```ts
import { createRepoTemplate } from '@mastra/e2b';

const template = createRepoTemplate({
  getRepositoryAccess: async () => ({ cloneUrl: 'https://github.com/acme/app.git' }),
  setupCommand: 'npm ci',
  buildStepEnv: { NPM_TOKEN: process.env.NPM_TOKEN! },
  buildEnvRevision: 'rev-2',
});
```
