---
'@mastra/core': patch
---

Fixed skills not loading on Windows when the workspace `basePath` uses a short folder name such as `C:\Users\ABCDEF~1\...`, which `os.tmpdir()` can return. Optional skill folders that don't exist, like `references`, no longer fail with `Permission denied`. Fixes [#28957](https://github.com/mastra-ai/mastra/issues/28957).
