---
'@mastra/core': patch
---

Fixed trace scoring so `type: 'agent'` scorers receive the tool calls an agent made. Scoring a stored agent trace (for example with `scoreTraceBatch` or `POST /api/observability/traces/score`) missed tool calls recorded under a model step. Tool calls and MCP tool calls are now included in the order they started. Calls made inside sub-agents or inside a tool are not credited to the parent agent.
