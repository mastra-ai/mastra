---
'@mastra/deployer': patch
---

Fixed module not found errors during production builds by skipping transitive dependency validation. Production builds now only bundle direct dependencies, which also results in faster deployment times.
