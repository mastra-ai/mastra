---
'@mastra/hono': patch
'@mastra/server': patch
---

Fixed custom API routes registered with registerApiRoute failing with a 500 error ("Response body object should not be disturbed or locked") when server middleware read the request body (e.g. await c.req.json()) before the route handler ran. Request bodies now survive middleware reads via json(), text(), formData(), or the raw request. Fixes https://github.com/mastra-ai/mastra/issues/22596
