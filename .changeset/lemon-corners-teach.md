---
'@mastra/deployer': patch
---

Fixed workspace packages with extensionless relative imports (e.g. `import { x } from './common'`) failing during `mastra dev`. Pre-compiled workspace packages (built with `tsc` or similar tools) that don't include `.js` extensions in their import paths now work correctly in dev mode.
