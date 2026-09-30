---
'@mastra/factory': patch
'@mastra/clickhouse': patch
'@mastra/modal': patch
'@mastra/server': patch
'mastracode': patch
'@mastra/core': patch
---

Fixed `ModalSandbox.clone()` ignoring the `workingDirectory` override, so clones now use the requested directory instead of the template's.
