---
'@mastra/schema-compat': patch
---

Fixed OpenAI silently refusing tools that have optional `integer` or `number` parameters with a `format` (for example `pageSize: { type: "integer", format: "int32" }` from the Google Drive MCP server). The `format` and numeric range keywords now appear only inside the typed `anyOf` branch instead of also on the outer property, so OpenAI accepts the tool instead of returning an empty, incomplete response.
