---
'@mastra/core': patch
---

Fix `threadId` and `resourceId` not being forwarded to `#runScorers` from `#executeOnFinish`, causing `onScorerRun` hook payloads to receive `undefined` for both fields
