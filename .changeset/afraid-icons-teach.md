---
'@mastra/editor': patch
'@mastra/core': patch
---

Fixed the @mastra/editor build failing on native Windows by using POSIX separators for tsup entry globs.
