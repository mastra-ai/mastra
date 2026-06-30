---
'@mastra/server': patch
---

Allow `'fs'` as an agent/scorer definition source in the server handlers and response schemas. File-based agents are registered with `source: 'fs'`, and the scorer/agent list endpoints now surface and validate that value instead of failing schema validation.
