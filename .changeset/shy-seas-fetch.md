---
'@mastra/core': patch
---

Forward parent agent client tools to sub-agents in supervisor mode. Previously, client tools defined on a parent agent were only visible to the supervisor agent. Now, when a supervisor delegates to a sub-agent, the parent client tools are forwarded so sub-agents can call them. When a sub-agent calls a client tool, the supervisor suspends so the client can execute the tool and resume with the result.
