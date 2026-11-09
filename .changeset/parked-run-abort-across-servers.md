---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed aborting a durable run that is waiting for tool approval when your app runs on more than one server. Before, the abort only took effect on the server that handled it, so approving the tool call on another server still ran the tool. The abort is now saved in storage, so every server rejects a later approval or resume of that run with a `409 Conflict` (`AGENT_RESUME_ABORTED_RUN`) and the tool doesn't run. Before, the same-server case returned a `500`.
