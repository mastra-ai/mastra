---
"@mastra/core": patch
---

Fix LocalFilesystem.resolvePath handling of absolute paths. Previously, absolute paths had their leading slashes stripped and were incorrectly resolved relative to basePath, causing PermissionError for valid paths within the workspace (e.g. skills processor accessing project-local skills directories).
