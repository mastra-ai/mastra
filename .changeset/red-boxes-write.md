---
'@mastra/pg': patch
---

Fixed auto-migration for the `mastra_observational_memory` table to include the `reflectedObservationLineCount` column. Previously, upgrading from older versions would crash on `Memory.cloneThread()` because this column was missing from the `ifNotExists` migration list.
