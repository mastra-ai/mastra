---
'@mastra/core': patch
---

Fix background sub-agent tool approvals restarting the delegation instead of resuming it. When a sub-agent run as a background task suspends on a tool approval, the nested run id (carried in `suspendOptions.runId`) is now bridged into the background task's persisted suspend data, so `resume` restores it and the sub-agent continues its existing run and executes the approved tool — rather than starting a fresh run and re-suspending on the same approval. Fixes #23626.
