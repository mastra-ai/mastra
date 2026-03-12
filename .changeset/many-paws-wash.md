---
'@mastra/server': patch
---

Moved @mastra/schema-compat from dependencies to devDependencies. This reduces the install footprint for consumers since schema-compat is only needed at build time.
