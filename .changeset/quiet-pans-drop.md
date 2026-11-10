---
'@mastra/core': patch
---

`Mastra.removeAgent()` now also drops the removed agent's processor configurations. Before, `getProcessorConfigurations()` kept listing an agent after it was removed, for example a stored agent that was edited or deleted. Registering the agent again adds them back.
