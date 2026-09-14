---
'@mastra/libsql': patch
---

Fixed LibSQL dataset writes to preserve JSON null in input, groundTruth, and expectedTrajectory across insertion, updates, and version history. Omitted dataset descriptions now read back as undefined, matching their declared type. Existing SQL NULL values are unchanged because previously lost distinctions cannot be recovered.
