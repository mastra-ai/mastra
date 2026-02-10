---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/editor': minor
'@mastra/client-js': minor
---

Add tool description overrides for stored agents:

- Changed stored agent `tools` field from `string[]` to `Record<string, { description?: string }>` to allow per-tool description overrides
- When a stored agent specifies a custom `description` for a tool, the override is applied at resolution time
- Updated server API schemas, client SDK types, and editor resolution logic accordingly
