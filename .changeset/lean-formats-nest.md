---
'@mastra/schema-compat': patch
---

Fixed OpenAI tools failing silently when an optional `integer` or `number` parameter has a `format` (for example `pageSize: { type: 'integer', format: 'int32' }` from Google's Drive MCP server). The OpenAI compat layer now keeps `format` and other type-specific keywords only inside the typed `anyOf` branch, instead of also leaving them next to `anyOf`, which OpenAI rejected with an empty `incomplete` response.
