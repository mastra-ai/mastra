---
'@mastra/core': patch
---

Removed a stale AI SDK UI utils dependency from @mastra/core so projects using Zod 4 do not get Zod 3 peer dependency warnings from core.
