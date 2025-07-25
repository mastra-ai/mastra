---
'@mastra/deployer': patch
'mastra': patch
---

This change implements a fix to sourcemap mappings being off due to `removeDeployer` Babel plugin missing source map config.
