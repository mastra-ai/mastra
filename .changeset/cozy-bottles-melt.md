---
'@mastra/core': patch
---

Fixed find_files and grep tools to always exclude .git directory contents — the .git directory is now skipped at the traversal boundary in both tools since its internals are never useful and waste tokens. Also fixed pipe-separated exclude patterns in find_files (e.g. ".git|node_modules") to work correctly, matching tree's -I flag behavior.
