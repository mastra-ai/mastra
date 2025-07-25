---
"@mastra/core": patch
"@mastra/deployer": patch
"@mastra/memory": patch
"@mastra/server": patch
"@mastra/libsql": patch
"@mastra/pg": patch
"@mastra/upstash": patch
"@mastra/client-js": patch
---

feat: add deleteMessage method to memory API

- Added `memory.deleteMessage(messageId)` method to delete individual messages
- Implemented deleteMessage in all storage adapters (LibSQL, PostgreSQL, Upstash, InMemory)
- Added REST API endpoint: `DELETE /api/memory/messages/:messageId`
- Added client SDK support: `thread.deleteMessage(messageId)`
- Updates thread timestamps when messages are deleted
- Added comprehensive test coverage and documentation