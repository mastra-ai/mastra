---
'@mastra/deployer': patch
---

Fixed workspace resolution when the Mastra app is the workspace root package. Workspaces that declare the root (for example `packages: ['.', 'packages/*']` in `pnpm-workspace.yaml`) now treat the root as a workspace package again, so `workspace:*` dependencies are packed into `workspace-module/` instead of being replaced with registry versions that fail to install.
