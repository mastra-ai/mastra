---
'@mastra/memory': patch
---

fix(memory): reflector now returns best non-degenerate result instead of empty string when all compression attempts produce degenerate output, preventing silent memory wipe
