---
'@mastra/core': patch
---

Reduced filesystem calls for workspace skills when `LocalFilesystem` has many `allowedPaths` entries, such as one per skill directory. Contained operations now resolve only the allowed paths that hold the file in the common case, and skill processing lists skills once per step instead of twice. Fixes [#30224](https://github.com/mastra-ai/mastra/issues/30224).
