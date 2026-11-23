---
'@mastra/core': patch
---

Fixed live scores from `createDurableAgent` and `createEventedAgent` agents. A score now names the agent as its entity, as on a regular `Agent`, so tools that group scores by agent find them. Evented agents that run on separate workers now export their scores too.
