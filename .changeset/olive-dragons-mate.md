---
'@mastra/pg': patch
---

Fix concurrent PostgreSQL observational memory initialization creating duplicate generations. Existing duplicate histories no longer block startup, but are not automatically repaired. Fixes #22188.

**Check for existing duplicates:** Run this read-only query against the schema containing your Mastra tables (replace `public` if you use another schema):

```sql
WITH generations AS (
  SELECT "lookupKey", "generationCount", COUNT(*) AS row_count,
         ARRAY_AGG(id ORDER BY "createdAt", id) AS row_ids
  FROM public.mastra_observational_memory
  GROUP BY "lookupKey", "generationCount"
), ranked AS (
  SELECT *, "generationCount" = MAX("generationCount") OVER (PARTITION BY "lookupKey") AS is_latest_generation
  FROM generations
)
SELECT "lookupKey", "generationCount", row_count, row_ids, is_latest_generation
FROM ranked
WHERE row_count > 1;
```

**Repair:** Back up the affected records before changing them. For every reported lookup key and generation, inspect the full rows identified by `row_ids` and determine which observations and reflections must be preserved. Reconcile those histories while writes to the affected memory are paused, then rerun the query to confirm that it returns no rows. Do not automatically delete all but one row: duplicates may contain different memory, and Mastra cannot safely choose a winner. Updated Mastra instances prevent new duplicates through coordinated writes; avoid running older instances alongside them during the upgrade.
