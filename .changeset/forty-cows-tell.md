---
'@mastra/inngest': patch
---

Fixed Inngest workflow resumes failing when persisted state grows too large by restoring resume state from storage instead of copying it into events.
