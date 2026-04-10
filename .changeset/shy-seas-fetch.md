---
'@mastra/core': patch
---

Forward parent agent client tools to sub-agents in both network and supervisor execution paths. Previously, client tools defined on a parent agent were only visible to the routing or supervisor agent. Now, when a network or supervisor delegates to a sub-agent, the parent client tools are forwarded via the stream/generate options so sub-agents can request them.
