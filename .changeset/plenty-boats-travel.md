---
'@mastra/core': minor
---

Added `agent.recoverResume()` to finish a tool approval or resume after the process handling it crashed, without asking for the decision again. Previously the approval or resume data only lived in the memory of that process, so a crash between approving and the tool running lost the answer and left the run stuck. The decision and the targeted tool call are now saved with the resume claim, and `recoverResume()` replays them once the claim is abandoned. Fixes #30285.

```typescript
// The process that called approveToolCall({ runId, toolCallId }) crashed.
const stream = await agent.recoverResume({ runId });
```
