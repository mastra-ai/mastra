---
'@mastra/mysql': patch
---

Fixed observational memory losing buffered observations or activated context when reflections, observation activation, and background buffering overlap, including from several processes or connection pools. Observational memory writes now lock the row they change and retry on deadlocks.

**Upgrading.** A nullable `supersededBy` column is added to the observational memory table automatically at startup. Existing rows are backfilled at the next startup of any process, so older generations stop accepting writes. Protection is complete once every process that shares the database runs the new version; older versions running alongside it neither set nor check the new column.

If you manage the schema yourself (`disableInit: true` or `MASTRA_DISABLE_STORAGE_INIT=true`), startup does not run this migration. Add a nullable `supersededBy` column, of the same type as `id`, to `mastra_observational_memory` before you upgrade, or reflections and buffered activation fail with a missing-column error.
