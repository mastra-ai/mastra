---
'@mastra/core': minor
'@mastra/deployer': minor
---

Add opt-in `bundler.pnpmWorkspaceSettings` to write custom pnpm install-policy and dependency-resolution settings to generated deployment workspaces. Explicit values override copied source settings, while deployer-managed keys, credentials, and execution settings are rejected. Existing behavior is unchanged when omitted.

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
