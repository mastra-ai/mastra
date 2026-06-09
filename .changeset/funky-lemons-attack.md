---
'@mastra/pg': patch
---

Added full Agent Builder storage support to the PostgreSQL adapter, bringing it to parity with libSQL.

Previously, projects using PostgreSQL could not store tool provider connections or agent tool providers, and several Agent Builder tables were missing from the exported schema.

- Added storage for tool provider connections, so connections can be created, read, listed by author, and deleted on PostgreSQL.
- Agent versions now persist their tool providers on PostgreSQL across save and load.
- Fixed schema export so all Agent Builder tables are included.
