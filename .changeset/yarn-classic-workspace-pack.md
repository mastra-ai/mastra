---
'@mastra/deployer': patch
---

Fixed `mastra build` on Yarn 1 (classic) workspaces leaving `workspace-module/` empty. Workspace dependencies are now packed into the build output, so installing the output no longer fails.
