---
'@mastra/observability': patch
---

Fixed provider API errors on traces showing only a message like "Service Unavailable". Span errors now include the HTTP status code, request URL, retryability and provider response body under `details`, so you can see what failed and where.
