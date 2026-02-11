---
'@mastra/server': minor
'@mastra/client-js': minor
---

**Added stored scorer CRUD API and updated editor namespace calls**

- Added server routes for stored scorer definitions: create, read, update, delete, list, and list resolved
- Added `StoredScorer` resource to the client SDK with full CRUD support
- Updated all server handlers to use the new editor namespace pattern (`editor.agent.getById`, `editor.agent.list`, `editor.prompt.preview`) and generic storage domain methods (`store.create`, `store.getById`, `store.delete`)
