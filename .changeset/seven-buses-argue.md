---
'@mastra/server': minor
---

Added `GET /auth/roles/:roleId/permissions` endpoint for admins to query resolved permissions for any role. Fixed auth middleware to respect `requiresAuth` on routes that match public path patterns.
