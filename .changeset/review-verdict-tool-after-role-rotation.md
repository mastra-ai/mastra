---
'@mastra/factory': patch
---

Fixed review sessions losing the `factory_record_review_verdict` tool when a session switched from building to reviewing partway through a run. The tool is now available on every step where the session's current role is review.
