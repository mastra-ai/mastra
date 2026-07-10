---
'@mastra/server': patch
'@mastra/code-sdk': patch
'mastracode': patch
---

Improved error responses in MastraCode Web. Unexpected route errors now return structured JSON with the actual error message instead of an opaque "Internal Server Error", and full error details (method, path, stack trace) are logged server-side.
