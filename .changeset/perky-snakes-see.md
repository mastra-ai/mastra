---
'@mastra/ai-sdk': patch
---

Fixed workflow streaming in @mastra/ai-sdk so intermediate `data-workflow` parts stop repeating every completed step output. Added `data-workflow-step` parts with the full payload for the step that just changed, which reduces stream size for long-running workflows while preserving final workflow outputs.

If your UI reads live step outputs during workflow execution, it should now consume `data-workflow-step` parts in addition to `data-workflow`. Final workflow snapshots still include the full step outputs.
