---
'@mastra/server': minor
'mastra': patch
---

Added `GET /observability/feedback/:feedbackId`. The endpoint returns `{ feedback: record | null }` and uses the existing observability authorization. Registered the route in the generated API CLI metadata.

Single-feedback reads include the same optional author details as the list endpoint. Author lookup failures do not prevent reading feedback. Older Core stores without single-feedback reads return HTTP 501.
