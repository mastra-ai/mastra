---
'mastracode-web': patch
---

MastraCode Web now stores all agent state (threads, messages, memory, recall vectors) in the single app Postgres (`APP_DATABASE_URL`) instead of per-user Turso/libSQL databases. Removes Turso auto-provisioning, the per-tenant URL templates, and the per-tenant Mastra dispatcher; users are separated by `resourceId` scoping within the shared database.
