---
'@mastra/ai-sdk': patch
---

When a v6 chat request carries several tool approvals, an approval that another request is already resuming is now skipped like an already-resolved one, so the remaining approvals in the request still run.
