---
'@mastra/server': patch
---

Add `POST /api/agents/:agentId/stream-until-idle` SSE route that mirrors `agent.streamUntilIdle()`. The route keeps the SSE stream open through background task completion and the agent's follow-up turn, so clients receive the final answer in a single request.
