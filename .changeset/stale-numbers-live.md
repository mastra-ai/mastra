---
"@mastra/server": minor
---

Add explicit context modes to feedback and score POSTs. Omitted mode preserves OSS direct writes; `resolve` derives stored root/target context and reports structured missing-anchor errors. Accept supplied timestamps and return normalized identity data.

```http
POST /api/observability/feedback
Content-Type: application/json

{ "contextMode": "resolve", "feedback": { "traceId": "trace-123", "feedbackType": "thumbs", "value": 1 } }
```

Keep feedback authors separate from span users. Without an authenticated user, HTTP requests that omit `feedbackUserId` store a null author, even when `userId` is supplied. Previously those requests could use `userId` as the author. Send `feedbackUserId` explicitly to identify the author; authenticated OSS requests continue to use the authenticated user's ID. The deprecated omitted-author `userId` alias remains available only through the storage API.

Platform retains its resolve default. Older servers may ignore the selector; explicit modes require supporting server versions.
