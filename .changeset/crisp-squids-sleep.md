---
'@mastra/core': patch
---

Fixed Harness v1 `ask_user` and `submit_plan` tools reading `runId` and `traceId` from fields that do not exist on the tool execution context, which broke the type build. They now read the current run and trace IDs from the harness session.
