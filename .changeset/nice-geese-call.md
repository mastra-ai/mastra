---
'@mastra/deployer': patch
---

Fixed `mastra build` installing the wrong version of a package when a pnpm override is scoped to your Mastra app, such as `'@my/app>@mastra/core': 1.82.0` next to a repo-wide `'@mastra/core': 1.67.0`. The build output is installed as a package named `server`, so the scoped override no longer matched and the repo-wide one won. Overrides scoped to the app now apply to the build output as they do in your project. Fixes [#29348](https://github.com/mastra-ai/mastra/issues/29348).
