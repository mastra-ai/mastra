---
'@mastra/core': patch
---

Fixed `resumeGenerate()` and `getFullOutput()` on durable agents sometimes never completing when a resumed run suspends again.
