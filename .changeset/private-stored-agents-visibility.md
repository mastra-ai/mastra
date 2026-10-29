---
'@mastra/server': patch
---

Fixed private stored agents being visible to and callable by other users through `/api/agents`. When auth is enabled, `GET /api/agents` now only lists the stored agents you own, public ones, and older agents without an owner. Opening, calling or streaming another user's private stored agent through `/api/agents/:agentId/*`, the Responses, Conversations, A2A, voice and agent-scores routes now returns 404, the same as `/api/stored/agents`. Admins and users granted access to a specific agent still have access. Code-defined agents and setups without auth are unaffected.

If other users relied on calling someone else's private stored agent, the owner needs to make that agent public.
