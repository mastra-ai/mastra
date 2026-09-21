---
'@mastra/server': patch
---

Return HTTP 409 when a feedback review-status update conflicts with a newer version of the feedback, so clients can retry instead of treating it as a server error.
