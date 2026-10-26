---
'@mastra/deployer': patch
---

Fixed `mastra build` so tsconfig `paths` imports of files with dots in their names are bundled, such as `import { repo } from 'src/repositories/user-repository.interface'`. Previously the import was left unresolved and the server failed to start with `ERR_MODULE_NOT_FOUND`. The build also no longer adds an unrelated npm package named after the first path segment (for example `src`) to the output dependencies.
