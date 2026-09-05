---
'mastra': patch
---

Fixed file replacements so values containing `$&`, `$$`, `` $` `` or `$'` are written to generated files exactly as provided instead of being expanded.
