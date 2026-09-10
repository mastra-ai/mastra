---
'@mastra/core': patch
---

Fixed pending tool forms and approvals appearing when saving their messages fails. Persistence now completes before the request is announced, and failed pending metadata is removed before another queued save proceeds.
