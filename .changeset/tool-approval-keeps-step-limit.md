---
'@mastra/core': patch
---

Fixed agent runs stopping mid-task after a tool approval. Approving or declining a tool call now resumes the run with the controller's full step budget instead of the agent's default of 5 steps, so the run no longer ends as "complete" a few steps later with work still pending.
