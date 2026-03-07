---
'@mastra/server': minor
'@mastra/core': patch
---

Added server routes for Agent orchestration features:

- `GET /api/agents/:agentId/modes` — list configured modes and current mode
- `POST /api/agents/:agentId/modes/switch` — switch to a different mode
- `GET /api/agents/:agentId/state` — get agent state
- `POST /api/agents/:agentId/state` — update agent state
- `POST /api/agents/:agentId/send` — send a message and stream lifecycle events via SSE

The `/send` endpoint streams agent events (`send_start`, `message_start`, `message_update`, `tool_start`, `tool_end`, `send_end`, etc.) as Server-Sent Events, enabling real-time UI updates.
