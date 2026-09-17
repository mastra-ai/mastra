---
'@mastra/inngest': patch
---

Fixed durable runs reporting success after finalization fails. Inngest runs now suspend the finalization step so the same run can resume without repeating completed model or tool steps.
