---
'@mastra/server': patch
---

Fixed `GET /api/tools` dropping tools that FGA allows when a tool is registered under a key other than its `id` (for example `tools: { deleteAccountTool }` with `id: 'delete-account'`). FGA still checks the tool by its `id`, as `POST /api/tools/:toolId/execute` does.
