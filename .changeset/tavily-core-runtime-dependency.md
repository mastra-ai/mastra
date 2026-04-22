---
"@mastra/tavily": patch
---

Fixed runtime `ERR_MODULE_NOT_FOUND` for `@tavily/core` by making it a direct dependency. Consumers no longer need to install `@tavily/core` manually.
