---
'@mastra/deployer': patch
---

Removed manual injection of `@mastra/schema-compat` dependency during deployment. This is no longer needed as `@mastra/core` now properly declares it as a direct dependency.
