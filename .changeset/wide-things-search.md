---
'@mastra/deployer': patch
---

Fixed a confusing `ERR_INVALID_ARG_VALUE` error being logged during `mastra build` while bundling the application. The build succeeded, but the logged stack trace suggested a failure.
