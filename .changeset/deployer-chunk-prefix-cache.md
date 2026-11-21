---
'@mastra/deployer': patch
---

Fixed `mastra dev` writing a workspace package's shared chunk into the cache of a different workspace package when one package directory path is a prefix of another (for example `packages/shared` and `packages/shared-db`). The chunk now goes to the package that actually owns it, so its dependencies resolve and the dev server starts.
