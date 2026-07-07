---
'mastra': patch
---

Fixed .env file changes not triggering dev server reload by resolving env file paths to absolute paths before passing them to Rollup's file watcher
