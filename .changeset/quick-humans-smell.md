---
'@mastra/core': patch
---

Improved file-based storage performance by removing a redundant filesystem stat call for every directory entry when listing domain and skill files, and by skipping the ISO date check for strings that can't be dates. Fixes #23752
