---
'@mastra/core': patch
---

Fixed `MCPServer` construction so it no longer throws `(0 , import_slugify.default) is not a function` when `@mastra/core` is consumed from CommonJS. Server ids and schedule ids now slugify correctly in both ESM and CJS projects. The underlying cause was the ESM-only `@sindresorhus/slugify` arriving double-wrapped through the CJS interop bridge; it is now resolved through an interop-safe helper.
