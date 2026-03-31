---
'@mastra/core': patch
---

Fixed workspace vector indexing silently swallowing embedder and search engine errors during auto-indexing. File-read errors (binary files, invalid UTF-8) are still skipped, but indexing failures are now logged as warnings instead of being silently ignored.
