---
'@mastra/inngest': patch
---

Fixed sendToolApproval to preserve approval decisions when Inngest agents receive custom resume data. Approval-gated calls now reject custom resume data unless it is a non-null object that can carry the decision, and unresolved approval targets fail instead of resuming without the decision.
