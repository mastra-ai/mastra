---
'@mastra/factory': patch
---

Factory self-review now checks the branch against the work item's stated problem. It separates blocking findings (correctness, safety, or test coverage of the stated fix, plus scope growth) from follow-ups. Only blocking findings send the card back to Building. Follow-ups go into the change request body. The builder is told to address every required change and to leave follow-ups alone.
