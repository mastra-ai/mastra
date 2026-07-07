---
'@mastra/core': patch
---

Normalize tool input schemas before JSON Schema conversion to avoid crashes with Zod v4 compatibility schemas that expose `~standard.validate` without native `~standard.jsonSchema`.
