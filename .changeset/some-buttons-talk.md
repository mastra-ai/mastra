---
'@mastra/oracledb': patch
---

Fixed observational memory losing buffered observations or activated context when reflections, observation activation, and background buffering overlap, including from several processes or connection pools. Fixed observational memory timestamps being stored up to an hour off when the server process runs in a time zone with daylight saving time; rows written before this fix keep their stored values.

**Upgrading.** A nullable `supersededBy` column is added to the observational memory table automatically at startup. Existing rows are backfilled at the next startup of any process, so older generations stop accepting writes. Protection is complete once every process that shares the database runs the new version; older versions running alongside it neither set nor check the new column.
