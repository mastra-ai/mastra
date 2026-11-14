---
'@mastra/memory': patch
'@mastra/libsql': patch
---

Fixed Observational Memory failing with "object is not iterable" right after a reflection on LibSQL databases created by older versions. Those databases stored observed message IDs as an empty object instead of a list, and they now read back correctly.
