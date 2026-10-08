---
'@mastra/core': patch
---

Fixed unnecessary workspace tool preparation. Fully disabled static configurations skip preparation entirely; otherwise, grep and search schemas and AST availability checks run only for enabled tools. Shared read tracking and write locks are created on demand. Per-tool overrides and dynamic configuration remain supported.
