---
'@mastra/server': minor
'@mastra/client-js': minor
---

Add `GET /stored/agents/:storedAgentId/dependents` endpoint to look up agents that
reference a given stored agent as a sub-agent.

Response shape:

- `dependents` — caller-readable agents (public and the caller's own private agents)
  with `id` + `name`.
- `hiddenCount` — cross-workspace dependents the caller cannot read, only surfaced when
  the target is public.

Access mirrors `GET /stored/agents/:storedAgentId` — 404 when the caller cannot read the
target. The client-js SDK exposes this as `client.getStoredAgent(id).dependents()`.
