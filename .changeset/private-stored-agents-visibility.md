---
'@mastra/server': patch
---

Fixed private stored agents being visible to and usable by other users outside `/api/stored/agents`. When auth is enabled, `GET /api/agents` now only lists the stored agents you own, public ones, and older agents without an owner, and every route that looks up an agent by id returns 404 for another user's private stored agent, the same as `/api/stored/agents`. This includes the agent version routes (`/api/stored/agents/:agentId/versions/*`): reading versions follows the same rules as reading the agent, and creating, activating, restoring or deleting versions requires the same access as editing it. Lists that search across agents (for example tools and workspaces) skip those agents too. Admins and users granted access to a specific agent still have access. Code-defined agents and setups without auth are unaffected.

`POST /api/agents/:agentId/clone` now makes the caller the owner of the clone and keeps it private, like `POST /api/stored/agents`. Previously a clone without an `authorId` in the body had no owner and was visible to everyone, and a body `authorId` could assign the clone to another user. That body field is now ignored when auth is enabled.

If other users relied on calling someone else's private stored agent, the owner needs to make that agent public.
