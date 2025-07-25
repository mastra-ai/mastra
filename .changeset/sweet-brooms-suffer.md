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

feat: add flexible deleteMessages method to memory API

- Added `memory.deleteMessages(input)` method that accepts multiple input types:
  - Single message ID as string: `deleteMessages('msg-123')`
  - Array of message IDs: `deleteMessages(['msg-1', 'msg-2'])`
  - Message object with id property: `deleteMessages({ id: 'msg-123' })`
  - Array of message objects: `deleteMessages([{ id: 'msg-1' }, { id: 'msg-2' }])`
- Implemented in all storage adapters (LibSQL, PostgreSQL, Upstash, InMemory)
- Added REST API endpoint: `POST /api/memory/messages/delete`
- Updated client SDK: `thread.deleteMessages()` accepts all input types
- Updates thread timestamps when messages are deleted
- Added comprehensive test coverage and documentation