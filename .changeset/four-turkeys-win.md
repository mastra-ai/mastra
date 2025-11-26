---
'@mastra/core': patch
---

Fix message metadata not persisting when using simple message format. Previously, custom metadata passed in messages (e.g., `{role: 'user', content: 'text', metadata: {userId: '123'}}`) was not being saved to the database. This occurred because the CoreMessage conversion path didn't preserve metadata fields.

Now metadata is properly preserved for all message input formats:
- Simple CoreMessage format: `{role, content, metadata}`
- Full UIMessage format: `{role, content, parts, metadata}`
- AI SDK v5 ModelMessage format with metadata

Fixes #8556
