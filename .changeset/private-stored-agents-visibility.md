---
'@mastra/server': patch
---

Fixed private stored agents being visible to and usable by other users outside `/api/stored/agents`. When auth is enabled, `GET /api/agents` now only lists the stored agents you own, public ones, and older agents without an owner, and every route that looks up an agent by id returns 404 for another user's private stored agent, the same as `/api/stored/agents`. Lists that search across agents (for example tools and workspaces) skip those agents too. Admins and users granted access to a specific agent still have access. Code-defined agents and setups without auth are unaffected.

If other users relied on calling someone else's private stored agent, the owner needs to make that agent public.
