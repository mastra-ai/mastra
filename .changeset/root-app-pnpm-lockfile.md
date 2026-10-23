---
'@mastra/deployer': patch
---

Fixed `mastra build` for apps at the root of a pnpm workspace on Linux. Workspace dependencies packed into `.mastra/output` were left as dangling symlinks, so the server failed at startup with `ERR_MODULE_NOT_FOUND`. The copied lockfile no longer keeps their workspace links, so pnpm installs the packed tarballs.
