---
'@mastra/core': patch
---

Fixed durable agent streams sometimes ignoring a suspension that arrived right after its tool-call chunk. The stream now finishes handling earlier chunks before it handles the suspension, so `resumeGenerate()` and `getFullOutput()` settle when a resumed run suspends again.
