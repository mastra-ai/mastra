---
'@mastra/mcp': patch
---

Advertise tool schemas as JSON Schema 2020-12 with the dialect declared, and validate structured results consistently for live and cache-hydrated MCP tools using the configured SDK validator. Schemas without a `$schema` declaration are treated as 2020-12 on the client; input and output schemas are bounded to 128 nested subschema levels and 10,000 subschema nodes. Null and tuple structured results round-trip unchanged.
