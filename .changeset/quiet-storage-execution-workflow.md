---
'@mastra/core': patch
---

Fixed noisy "Cannot get workflow run. Mastra storage is not initialized" debug logs that appeared on every `agent.generate()` and `agent.stream()` call when the agent's Mastra instance had storage configured.

The internal workflow that runs each agent call never received the parent Mastra instance, so it could not see configured storage and logged the warning before falling back to in-memory state. It now receives the Mastra instance. It still does not write any of its own snapshots to your storage, so no extra rows are created.
