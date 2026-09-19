---
'@mastra/factory': patch
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed a zod version mismatch that could make tool and workflow schemas built by these packages incompatible with schemas from @mastra/core.
