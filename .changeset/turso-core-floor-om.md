---
'@mastra/turso': patch
---

Raised the `@mastra/core` peer dependency floor to `>=1.76.0-0` to match `@mastra/libsql`, which `@mastra/turso` depends on and which now needs the observational memory storage helpers added in that `@mastra/core` version.
