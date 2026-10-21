---
'@mastra/core': patch
---

Fixed a misleading "No memory is configured but resourceId and threadId were passed in args" warning logged every time Observational Memory ran its Observer or Reflector. The warning now fires only when `memory.thread` and `memory.resource` are passed to an agent that has no memory, not when the ids come from the request context (auth middleware, AgentController), which every agent in the request inherits.
