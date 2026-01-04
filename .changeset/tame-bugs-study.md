---
'@mastra/deployer': patch
---

Fix Windows `ERR_UNSUPPORTED_ESM_URL_SCHEME` error by using `pathToFileURL()` instead of manually constructing file URLs in the validator
