---
'@mastra/inngest': patch
---

Fixed resuming a step that suspended inside a nested workflow on the Inngest engine. Resuming by the nested workflow's step id or by a resume label no longer fails with "No suspended steps found in nested workflow" (#23182).
