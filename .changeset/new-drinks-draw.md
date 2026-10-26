---
'@mastra/deployer': patch
---

Fixed `mastra build` leaving tsconfig `paths` imports unresolved when the target file name contains a dot, such as `import { repo } from 'src/repositories/user-repository.interface'`. The import was kept as an external package import, the server failed to start with `ERR_MODULE_NOT_FOUND`, and an unrelated npm package matching the first path segment (for example `src`) was added to the output dependencies.
