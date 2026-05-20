---
'mastracode': patch
---

Fixed goal judge stopping early by setting explicit maxSteps (50) and adding a follow-up retry prompt when no structured decision is returned. Fixed /goal resume to retrigger judge evaluation instead of the main agent when the pause was caused by a judge failure, including when there is no new assistant response for the judge to evaluate.
