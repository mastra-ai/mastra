---
'@mastra/core': patch
---

Fixed createTool types due totight coupling to Zod's internal structure, which changed between v3 and v4. Instead of checking for exact Zod types, we now use structural typing - checking for the presence of parse/safeParse methods
