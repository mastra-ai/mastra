---
'@mastra/server': patch
---

Fixed private stored agents being visible to and usable by other users outside `/api/stored/agents`. With auth enabled, the rules from `/api/stored/agents` now apply everywhere an agent is looked up. Admins, owners, users granted access to a specific agent, code-defined agents and setups without auth are unaffected.

**Agent routes**

- `GET /api/agents` only lists the stored agents you own, public ones, and older agents without an owner.
- Every route that looks up an agent by id returns 404 for another user's private stored agent, the same as for a missing agent.
- Agent version routes (`/api/stored/agents/:agentId/versions/*`) follow the same rules. Reading versions needs read access; creating, activating, restoring or deleting them needs edit access.
- Changing or resetting a stored agent's model at runtime (`POST /api/agents/:agentId/model` and `/model/reset`) now needs edit access, because the change applies to everyone using the agent. Before, anyone who could run a public stored agent could swap its model.

**Lists, workspaces and schedules**

- Lists that search across agents (for example tools, workspaces and processor details) skip agents you can't see.
- The `/api/workspaces/:workspaceId/*` routes treat a private stored agent's workspace as missing for other users.
- Agent schedules follow the visibility of the agent they run. `GET /api/schedules` hides schedules of stored agents you can't see, and reading, updating, pausing, resuming, firing or deleting one of them returns 404.

**Cloning**

`POST /api/agents/:agentId/clone` now makes the caller the owner of the clone and keeps it private, like `POST /api/stored/agents`. The body `authorId` is ignored when auth is enabled, and a signed-in user without an id gets 403.

```ts
// Before: alice clones her private agent; the clone has no owner and is public
await fetch('/api/agents/alice-private/clone', { method: 'POST', body: JSON.stringify({ newId: 'copy' }) });
// → { id: 'copy', authorId: null }

// Before: a body authorId assigns the clone to another user
await fetch('/api/agents/shared/clone', { method: 'POST', body: JSON.stringify({ newId: 'copy', authorId: 'alice' }) });
// → { id: 'copy', authorId: 'alice' }

// After: the caller always owns the clone and it stays private
// → { id: 'copy', authorId: '<caller>', visibility: 'private' }
```

If other users relied on calling someone else's private stored agent, the owner needs to make that agent public.
