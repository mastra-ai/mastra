---
'@mastra/core': patch
---

Added validation to detect incompatible `LocalFilesystem` configuration with `contained: false` when used as a mount in `CompositeFilesystem`. This combination silently produced incorrect path resolution — the system now logs a warning at construction time with guidance to use `contained: true` (default) or `allowedPaths` instead.
