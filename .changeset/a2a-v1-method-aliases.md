---
'@mastra/server': patch
'@mastra/client-js': patch
---

Accept A2A v1 PascalCase JSON-RPC method names when the `A2A-Version: 1.0` header is present. Normalize method names before dispatch and streaming response selection while preserving legacy slash-style methods.

For example, retrieve an existing task with `GetTask` (replace the agent and task IDs with your own):

```http
POST /api/a2a/my-agent HTTP/1.1
Content-Type: application/json
A2A-Version: 1.0

{"jsonrpc":"2.0","id":"request-1","method":"GetTask","params":{"id":"task-1"}}
```
