---
'@mastra/factory': patch
---

Fixed the session access checks skipping multipart form requests. A form-encoded request that names another person's private session or memory resource, or that sets a shared session's thinking level, is now refused the same way as a JSON request.
