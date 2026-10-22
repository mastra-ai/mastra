---
'@mastra/core': patch
---

Verify contained local filesystem reads against opened file descriptors so symlink replacement cannot redirect readFile, stat, exists, realpath, or directory listing outside the configured roots.
