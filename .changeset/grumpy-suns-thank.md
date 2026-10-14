---
'@mastra/factory': patch
---

Fixed environment migration to leave the workspace root unset instead of copying a legacy repository checkout path. Preserve explicitly configured roots and cleared values across initialization.
