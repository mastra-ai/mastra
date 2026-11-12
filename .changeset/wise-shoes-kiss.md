---
'@mastra/core': patch
---

Fixed channel tool approvals being ignored after `AgentChannels` is rebuilt or the bot restarts. Clicking Approve or Deny on a card now works even when more than 50 messages were posted in the thread after the approval was requested, and only the user who triggered the tool can still answer it. Repeated clicks on the same card reuse the first lookup instead of reading the thread again, and clicks on an approval that was already answered are ignored instead of posting an error. A late click on an answered card no longer resumes the run's next approval on a `DurableAgent`. Fixes [#29186](https://github.com/mastra-ai/mastra/issues/29186).

Resume errors are easier to act on: a `DurableAgent` resume of a run with no stored snapshot now throws a `MastraError` with id `AGENT_RESUME_NO_SNAPSHOT_FOUND` (same message as before), and `AGENT_RESUME_TOOL_CALL_NOT_SUSPENDED` carries `details.timedOut: true` when the agent only gave up waiting for the suspension to be saved, so callers can retry it.
