---
'@mastra/deployer': patch
---

Fixed Windows crash where the Mastra dev server failed to start with `ERR_UNSUPPORTED_ESM_URL_SCHEME` error. The deployer now correctly handles Windows file paths.
