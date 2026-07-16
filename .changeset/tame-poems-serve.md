---
'@mastra/core': patch
---

Fixed background tasks never executing when Mastra is used as a library without a Mastra server. Previously, background-eligible tool calls (including background subagent delegations) were dispatched but stayed in the `running` state forever because the task workers only started with a Mastra server (`mastra dev` or a deployed server). Now the workers start automatically on the first background task dispatch or resume, so background tasks complete in apps that embed Mastra directly (for example Express or Next.js servers). Fixes [#19339](https://github.com/mastra-ai/mastra/issues/19339).
