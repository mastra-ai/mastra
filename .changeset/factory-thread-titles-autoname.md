---
'@mastra/factory': patch
---

Fixed Factory session threads keeping their initial work-item title forever. Those titles are derived from the work item rather than typed by a user, so they no longer opt out of automatic title updates.
