---
'@mastra/deployer': patch
---

Fixed circular dependency errors when deploying to Mastra Cloud. Packages @mastra/loggers and @mastra/libsql are now properly externalized during bundling, preventing the 'reexport that references itself' error. This fix allows cloud deployments to succeed even when users don't have these packages explicitly installed in their project.
