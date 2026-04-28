---
'@mastra/server': patch
---

Fixed a security issue where any authenticated user could access another user's private stored agents. Broad role permissions (e.g. `agents:read`) now correctly respect ownership and visibility — only the owner, admins, or users with an agent-specific permission can access a private agent.
