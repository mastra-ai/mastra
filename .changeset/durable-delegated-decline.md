---
'@mastra/core': patch
---

Fixed durable agents not forwarding a declined sub-agent tool approval to the sub-agent. When a supervisor declines a tool approval raised by a sub-agent, the decline and its reason now reach the suspended sub-agent run, matching the approve path and the regular `Agent`. Declining the supervisor's own tool approval still denies the call locally.
