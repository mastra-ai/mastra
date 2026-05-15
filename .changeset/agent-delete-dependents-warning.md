---
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/playground': minor
---

Surface star and dependent-agent warnings in the agent-builder delete and make-private confirmation dialogs. Adds a new `GET /stored/agents/:storedAgentId/dependents` endpoint (and matching `StoredAgent.dependents()` client method) that lists other stored agents whose resolved configuration references the target agent as a sub-agent. The delete dialog and the public→private confirmation dialog now call this endpoint and show an informational warning when the agent has been starred and/or used by other agents (including the names of up to 5 dependent agents); the action is still allowed.
