---
"@mastra/schema-compat": patch
---

Null types from MCP tool schemas no longer cause startup crashes.

MCP servers that expose `{ "type": "null" }` in their tool JSON Schemas caused `@mastra/schema-compat` to throw on startup. These null types are now coerced to an optional schema so tools load correctly. Fixes [#13315](https://github.com/mastra-ai/mastra/issues/13315).
