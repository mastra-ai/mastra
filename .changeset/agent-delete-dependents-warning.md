---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added `GET /stored/agents/:storedAgentId/dependents` endpoint that lists agents
referencing a stored agent as a sub-agent.

```ts
const { dependents, hiddenCount } = await client.getStoredAgent(id).dependents();
// { dependents: [{ id: 'parent-1', name: 'Triager' }], hiddenCount: 2 }
```

- `dependents` — caller-readable agents (public agents and the caller's own private
  agents) with `id` + `name`.
- `hiddenCount` — cross-workspace dependents the caller cannot read, only surfaced
  when the target agent is public.

Access mirrors `GET /stored/agents/:storedAgentId` — 404 when the caller cannot
read the target.
