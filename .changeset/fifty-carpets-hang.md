---
'@mastra/inngest': patch
---

Fixed Inngest durable agents and workflows so request context values are preserved when runs start, resume, and invoke nested workflows. Previously the trigger and resume events sent an empty request context, so tools, processors, and dynamic resolvers inside a durable run could not see values the caller set (for example tenant or user IDs).
