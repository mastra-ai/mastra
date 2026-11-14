---
'@mastra/libsql': patch
---

Fixed LibSQL storage write failures printing raw database errors after Mastra was created with `logger: false` or a custom logger. Storage write retry and failure logs now go through the configured logger and include only the error type and code, not the error message, cause or stack. The original error is still thrown to the caller. Fixes [#29885](https://github.com/mastra-ai/mastra/issues/29885).
