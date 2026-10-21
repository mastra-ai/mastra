---
'@mastra/deployer-netlify': patch
---

Netlify installs now apply `bundler.pnpmWorkspaceSettings` and packed workspace dependency `pnpmOverrides` to the generated pnpm workspace, for both edge and serverless targets.
