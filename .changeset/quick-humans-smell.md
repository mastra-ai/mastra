---
'@mastra/core': patch
---

Improved file-based storage performance by removing a redundant filesystem stat call for every directory entry when listing domain and skill files, and by skipping the ISO date check for strings that can't be dates. As part of this change, file listings no longer follow symbolic links, so a symlink pointing at a stored file or directory is no longer included in results. Fixes #23752
