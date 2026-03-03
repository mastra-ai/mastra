---
'@mastra/mysql': patch
---

Fixed several MySQL storage reliability issues reported in PR review:

- Fixed `createTable` to avoid passing `undefined` bind parameters when database is not explicitly configured.
- Fixed `updateMessages` to skip no-op updates, preventing invalid SQL in batched updates.
- Made experiment deletion transactional to avoid partial deletes.
- Added rollback behavior when creating agents, prompt blocks, and scorer definitions if initial version creation fails.
- Improved error semantics for update-not-found cases in MCP servers, prompt blocks, and scorer definitions.
- Hardened delete statement utilities to reject empty key filters.
- Improved MySQL package test startup checks so `pretest` fails when the DB never becomes ready.
