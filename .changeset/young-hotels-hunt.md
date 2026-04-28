---
'@mastra/server': minor
---

Stored agents and skills now have ownership and visibility controls. Each resource is automatically assigned to the user who created it. Regular users see their own resources plus any public ones; admins see everything. Updating or deleting a resource is restricted to its owner (admins can bypass). Cloned agents are assigned to the cloning user and default to private.
