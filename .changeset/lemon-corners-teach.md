---
'@mastra/deployer': patch
---

Fixed `mastra dev` failing with `ERR_MODULE_NOT_FOUND` when workspace packages use extensionless relative imports (e.g. `import { x } from './common'` instead of `'./common.js'`).
