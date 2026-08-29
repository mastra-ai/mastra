---
'@mastra/factory': minor
---

Attention now rides the project feed stream end to end: automation failures, approval proposals, approvals, dismissals, retries, work-item deletions, and read receipts publish a `factory.attention.touched` event, forwarded to clients as an `attention` SSE frame. The attention page refetches the moment something changes and polls only while the stream is down.
