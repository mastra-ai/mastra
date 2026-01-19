---
'@mastra/deployer': patch
'@mastra/deployer-cloud': patch
---

Fixed circular dependency errors when deploying to Mastra Cloud. Added `getAdditionalExternals()` hook to the Bundler base class, allowing deployers to specify deployer-specific packages that should be externalized during bundling. CloudDeployer now uses this hook to externalize `@mastra/loggers` and `@mastra/libsql`, preventing the 'reexport that references itself' error without affecting other deployers.
