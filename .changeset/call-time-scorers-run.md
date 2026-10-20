---
'@mastra/core': patch
---

Fixed live scorers passed at call time (`agent.stream(..., { scorers })`) or through `defaultOptions.scorers` never running unless the same scorer was also registered on the agent or on Mastra. Such scorers now run and save their scores on every agent engine, including durable and evented agents.
