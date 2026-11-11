---
'@mastra/core': patch
---

Fixed processor listings showing agents that were removed. `getProcessorConfigurations()` and `listProcessorConfigurations()` kept listing an agent after `Mastra.removeAgent()`, for example a stored agent that was edited or deleted, or one used only as a sub-agent. `removeAgent()` now drops the agent's processor configurations, and registering it again adds them back. Each configuration also records the `source` of the agent that added it, so a stored agent's configurations can be told apart from a code agent's.
