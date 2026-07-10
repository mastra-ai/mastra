---
'@mastra/server': patch
'@mastra/code-sdk': patch
'mastracode': patch
---

Added server-side logging for custom API route errors. When a custom route handler throws and no onError handler is configured, the error is now logged with the request method, path, and stack trace instead of being silently swallowed before the 500 response.
