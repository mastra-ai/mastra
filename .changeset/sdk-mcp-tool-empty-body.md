---
'@mastra/client-js': patch
---

Fix `MCPTool.execute` sending an empty/undefined request body when called without `data` or `requestContext`. The server's tool-execute endpoint expects an object body (with optional `data`), so calls like `client.getMcpServerTool(serverId, toolId).execute({})` would fail with `Invalid request body`. The SDK now always POSTs a JSON object body, defaulting to `{}` when no parameters are provided.
