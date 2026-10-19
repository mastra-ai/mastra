---
'@mastra/core': patch
---

Fixed workspace content search ignoring `.gitignore` files below the workspace root. Searches now apply every `.gitignore` relative to its own directory (for example, each repository in a multi-repo workspace) and skip `node_modules` unless the search path points inside it. This keeps the host-side search from reading dependency files one by one on remote filesystems.
