---
'@mastra/core': patch
---

Fixed workspace search and file listing so a deeper `.gitignore` can re-include what a parent ignores (for example `!keep.log` in a subdirectory overriding `*.log`), matching git. Search results from a filesystem's native `grep` now also apply `.gitignore` files in subdirectories of the search path.
