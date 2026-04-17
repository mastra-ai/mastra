---
"@mastra/schema-compat": patch
---

Fixed MCP tool validation failures when tools use JSON Schema draft 2020-12. Tools from providers like Firecrawl that declare `$schema: "https://json-schema.org/draft/2020-12/schema"` now validate correctly instead of throwing "no schema with key or ref" errors.
