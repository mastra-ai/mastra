---
'@mastra/client-js': patch
'@mastra/ai-sdk': patch
'@mastra/react': patch
'@mastra/server': patch
'@mastra/core': patch
'@mastra/schema-compat': patch
---

Fix Zod v3 and Zod v4 compatibility across public structured-output APIs.

Mastra agent and client APIs accept schemas from either `zod/v3` or `zod/v4`, matching the documented peer dependency range and preserving TypeScript compatibility for both Zod versions.
