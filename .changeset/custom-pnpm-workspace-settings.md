---
'@mastra/core': minor
'@mastra/deployer': minor
---

Add opt-in `bundler.pnpmWorkspaceSettings` to write pnpm install-policy settings to generated deployment workspaces. Supported keys are `allowBuilds`, `onlyBuiltDependencies`, `ignoredBuiltDependencies`, `minimumReleaseAge`, `minimumReleaseAgeExclude`, `trustPolicy`, `trustPolicyExclude`, `trustPolicyIgnoreAfter`, and `blockExoticSubdeps`; explicit values override copied source settings and any other key is rejected before pnpm runs. Existing behavior is unchanged when omitted.

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
