---
'@mastra/deployer': patch
---

Fixed CommonJS deployments by bundling `@sindresorhus/slugify` instead of requiring it as an ESM-only runtime dependency.
