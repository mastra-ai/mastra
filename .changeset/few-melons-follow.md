---
'@mastra/core': minor
---

Added parentToolCalls to delegation hook contexts (onDelegationStart, onDelegationComplete, messageFilter). Supervisor agents now expose the parent agent's tool call history — including tool names, arguments, and results — to all delegation hooks, enabling smarter routing and context-aware delegation decisions.
