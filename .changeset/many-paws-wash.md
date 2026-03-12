---
'@mastra/server': patch
---

Fixed an unnecessary runtime dependency in `@mastra/server`, reducing install size for consumers. Moved `@mastra/schema-compat` from dependencies to devDependencies since it is only needed at build time.
