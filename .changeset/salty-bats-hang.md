---
'@mastra/code-sdk': patch
---

Fixed plugin updates occasionally keeping stale code loaded. When an updated plugin file had the same size and modification timestamp as the previous version, the reload could reuse the old module; plugin reloads now detect changes by file content, so an update always runs the new code.
