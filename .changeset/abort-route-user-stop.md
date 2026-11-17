---
'@mastra/server': patch
---

The AgentController abort route (`POST /agent-controller/:controllerId/sessions/:sessionId/abort`) now marks the stop as a person's Stop. The run's `agent_end` event reports `abortReason: 'user-stop'`.
