---
'@mastra/client-js': patch
---

Fixed RequestContext type mismatch when using @mastra/client-js alongside @mastra/core. Moved @mastra/core from a bundled dependency to a peer dependency, matching the pattern used by all other @mastra packages. This prevents duplicate installations that caused TypeScript error `ts(2769): Types have separate declarations of a private property 'registry'`.
