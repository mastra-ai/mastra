---
'@mastra/e2b': minor
---

`E2BFactorySandbox` now passes a Factory's Build environment variables to template builds. `createRepoTemplate()` accepts `buildEnvRevision`. When it's set, the template name uses the revision instead of hashing the `buildEnv` values, so secrets stay out of the name. Change the revision whenever the values change to build a new template. Without a revision, `buildEnv` works as before. `buildEnv` values are still sent to E2B with the template definition so build steps can read them, so prefer short-lived tokens.

```ts
import { createRepoTemplate } from '@mastra/e2b';

const template = createRepoTemplate({
  getRepositoryAccess: async () => ({ cloneUrl: 'https://github.com/acme/app.git' }),
  setupCommand: 'npm ci',
  buildEnv: { NPM_TOKEN: process.env.NPM_TOKEN! },
  buildEnvRevision: 'rev-2',
});
```
