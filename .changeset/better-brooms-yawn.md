---
'@mastra/deployer': patch
---

Fixed module resolution failing on Windows with `ERR_INVALID_URL_SCHEME` errors. Windows absolute paths (e.g., `C:\path\to\file`) are now correctly skipped during node_modules resolution instead of being treated as package names.
