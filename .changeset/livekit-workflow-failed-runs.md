---
'@mastra/livekit': patch
---

Fixed workflow-driven voice turns being reported as successful when the workflow run failed. `createWorkflowReplyGenerator` now errors the reply stream when the run fails and no longer calls `onTurnComplete` for it, so a failed turn is no longer saved to memory as an empty or partial assistant reply.
