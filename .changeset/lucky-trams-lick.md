---
'@mastra/core': patch
---

Fixed sendToolApproval to preserve separate approval decisions when custom resume data is provided. Approval-gated calls now reject custom resume data unless it is a non-null object that can carry the decision.
