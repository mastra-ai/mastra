---
'@mastra/client-js': patch
---

Fixed RequestContext type incompatibility when using @mastra/client-js alongside @mastra/core. Previously, @mastra/client-js could install its own separate copy of @mastra/core, causing TypeScript to reject valid RequestContext usage. Now @mastra/client-js shares the same @mastra/core instance as the rest of your project, matching the pattern used by all other @mastra packages.
