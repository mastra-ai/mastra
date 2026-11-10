---
'@mastra/e2b': minor
---

Added a `buildEnvRevision` option to `createRepoTemplate()`. When it's set, the template name uses the revision instead of a hash of the `buildEnv` values, so secrets stay out of a name anyone listing templates can see. Change the revision whenever the values change to build a new template. Without a revision, `buildEnv` works as before. `E2BFactorySandbox` passes `buildEnv` and `buildEnvRevision` from the sandbox context through to it.

`buildEnv` values are still sent to E2B with the template definition so build steps can read them, so prefer short-lived tokens.

```ts
import { createRepoTemplate } from '@mastra/e2b';

const template = createRepoTemplate({
  getRepositoryAccess: async () => ({ cloneUrl: 'https://github.com/acme/app.git' }),
  setupCommand: 'npm ci',
  buildEnv: { NPM_TOKEN: process.env.NPM_TOKEN! },
  buildEnvRevision: 'rev-2',
});
```
