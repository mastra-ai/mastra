---
'@mastra/core': patch
---

Provider errors are now diagnosable after the fact. When a model call fails with an HTTP error, the error part saved to the thread keeps the `statusCode`, the provider's `responseBody` (capped at 2,000 characters) and the provider `requestId`, alongside `name` and `message`. Chat channels (Slack, Discord, …) now post the provider's explanation instead of just the HTTP status text, for example `❌ Error: Bad Request (HTTP 400): prompt is too long (request id req_123)`, and log the same fields.
