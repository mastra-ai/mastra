---
"@mastra/core": patch
---

Workspace list_files tool now correctly handles pattern "*" by treating it as "**/*", matching files at all depths instead of silently returning 0 files.
