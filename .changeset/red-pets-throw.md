---
'@mastra/client-js': patch
'@mastra/server': patch
'mastra': patch
---

Removed `save_messages` and `search_memory` from the built-in MCP memory toolset, and added a read-only `get_working_memory` tool.

MCP clients can now inspect working memory without changing it, for a thread or for the caller's resource:

```json
{ "name": "get_working_memory", "arguments": { "agentId": "support-agent", "threadId": "thread-123" } }
```

Leave out `threadId` to read resource-scoped working memory. It is also served over HTTP at `GET /api/memory/working-memory?agentId=support-agent&resourceId=user-456`. Servers that map users to resources can omit `resourceId`; the caller's resource is used either way.

If an MCP client called `save_messages` or `search_memory`, call the HTTP endpoints instead. They are unchanged: `POST /api/memory/save-messages?agentId=...` saves messages, and `GET /api/memory/search?agentId=...&resourceId=...&searchQuery=...` searches memory.
