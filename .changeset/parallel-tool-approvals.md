---
'@mastra/core': patch
---

Fixed tool calls that need approval running one at a time with an approval between each. When the model calls several approval-gated tools in one step, every approval is now requested at once on regular, durable, and evented agents, and each call starts as soon as it is approved. Tools that can suspend still run one at a time, and so do approval-gated calls inside a sub-agent delegated to by another agent.
