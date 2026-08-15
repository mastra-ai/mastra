---
'@mastra/core': patch
---

Fix sub-agent and workflow delegation attempting to resume a non-existent snapshot when the model populates `resumeData` with no suspended run (issue #21608)
