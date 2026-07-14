---
'@mastra/core': patch
---

Fixed parallel sub-agent approvals so they can be handled in any order. listSuspendedRuns() now returns each pending sub-agent call, and approving one resumes that specific call instead of using another call’s suspended state.
