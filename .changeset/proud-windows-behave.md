---
'@mastra/server': patch
'@mastra/core': patch
---

Fixed recursive schema warnings for processor graph entries by unrolling to a fixed depth of 3 levels, matching the existing rule group pattern
