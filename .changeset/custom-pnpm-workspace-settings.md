---
'@mastra/core': minor
'@mastra/deployer': minor
'@mastra/deployer-netlify': patch
mastra: patch
---

Add opt-in `bundler.pnpmWorkspaceSettings` to write pnpm install-policy settings to generated deployment workspaces, including the Netlify deployer and the CLI experiment bundler. Supported keys are `allowBuilds`, `onlyBuiltDependencies`, `ignoredBuiltDependencies`, `neverBuiltDependencies`, `minimumReleaseAge`, `minimumReleaseAgeExclude`, `trustPolicy`, `trustPolicyExclude`, `trustPolicyIgnoreAfter`, and `blockExoticSubdeps`; explicit values override copied source settings and any other key is rejected before pnpm runs. Existing behavior is unchanged when omitted.

```ts
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  bundler: {
    pnpmWorkspaceSettings: {
      blockExoticSubdeps: false,
    },
  },
});
```
