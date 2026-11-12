---
'@mastra/server': patch
---

Fixed `GET /api/tools` dropping tools that FGA allows when a tool is registered under a key other than its `id` (for example `tools: { deleteAccountTool }` with `id: 'delete-account'`). FGA still checks the tool by its `id`, as `POST /api/tools/:toolId/execute` does.

If your FGA policies identify tools by the key they are registered under, update them to use the tool's `id`. Until then, those tools are left out of the list.
