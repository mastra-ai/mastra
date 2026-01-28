---
"@mastra/hono": patch
"@mastra/server": patch
---

Fixed malformed JSON body handling in Hono adapter. When a POST request contains invalid JSON (e.g., missing closing braces), the server now returns HTTP 400 Bad Request with a structured error message instead of silently accepting the request with HTTP 200. This prevents workflows from starting with undefined input data. ([#12310](https://github.com/mastra-ai/mastra/issues/12310))
