---
'@mastra/server': patch
---

Fixed Studio threads failing with `Gateway API error 404` for agents using `mastra/` models with an organization (v2) Gateway key. Threads, messages, and observational memory now load from the agent's local storage, since v2 Gateway keys do not use hosted memory.

Fixed the observational-memory routes reading records for any `resourceId` a caller supplied. They now use the server-resolved resource ID and check thread access, like the other memory routes.
