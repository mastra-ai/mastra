---
'@mastra/core': patch
---

Fixed find_files tool to properly exclude .git directory contents — the .git directory is now always excluded from listings since its internals are never useful and waste tokens. Also fixed pipe-separated exclude patterns (e.g. ".git|node_modules") to work correctly, matching tree's -I flag behavior.
