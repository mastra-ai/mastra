---
'@mastra/pg': patch
---

Fixed observational memory losing buffered observations or activated context when reflections, observation activation, and background buffering overlap, including from several processes or connection pools. Observational memory writes now lock the row they change, and the current generation is always read from the primary, never a lagging read replica. Fixed `lastBufferedAtTime` being read back shifted by the host's time-zone offset.

**Upgrading.** A nullable `supersededBy` column is added to the observational memory table automatically at startup. Existing rows are backfilled at the next startup of any process, so older generations stop accepting writes. Protection is complete once every process that shares the database runs the new version; older versions running alongside it neither set nor check the new column.
