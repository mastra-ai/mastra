---
'@mastra/core': patch
---

Fixed trace scoring so `type: 'agent'` scorers receive the tool calls an agent made. Previously, scoring a stored agent trace (for example with `scoreTraceBatch` or `POST /api/observability/traces/score`) always produced an empty `toolInvocations` list, because tool calls are recorded under the model step rather than directly under the agent run. Tool calls and MCP tool calls are now collected in the order they started; calls made inside sub-agents or inside a tool are not credited to the parent agent.
