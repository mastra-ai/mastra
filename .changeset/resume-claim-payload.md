---
'@mastra/core': patch
---

Persisted the resume payload with the agent resume claim, so a run can be finished after the process that received an approval died.

`approveToolCall()`, `declineToolCall()` and `resumeStream()` carry the decision in memory only. When the process handling the resume died between claiming the suspended run and executing the suspended tool, the decision was lost: the run stayed `running` with nothing in storage to finish it. A resume now writes the payload it resumes with onto the claim, and a later resume that takes over an abandoned claim replays it instead of asking for approval again.

Added `agent.resumeClaimedRun({ runId })` for hosts that no longer hold the decision and cannot re-supply it.
