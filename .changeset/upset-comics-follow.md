---
'@mastra/core': patch
---

Fixed tilde (~) paths not expanding to the home directory in LocalFilesystem and LocalSandbox. Paths like `~/my-project` were silently treated as relative paths, creating a literal `~/` directory instead of resolving to `$HOME`. This affects `basePath`, `allowedPaths`, `setAllowedPaths()`, all file operations in LocalFilesystem, and `workingDirectory` in LocalSandbox.
