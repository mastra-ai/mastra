---
'@mastra/pg': patch
---

Make `listWorkflowRuns` status filtering indexable on Postgres. The status predicate previously wrapped every snapshot in a `regexp_replace(snapshot::text, ...)::jsonb` sanitization step, which forced a sequential scan over the whole `mastra_workflow_snapshot` table. On `jsonb` snapshot columns Postgres already rejects the problematic Unicode escape sequences at insert time, so the sanitization was a no-op there and the query now uses a plain `snapshot->>'status'` comparison backed by a new default expression index on `(workflow_name, snapshot->>'status', "createdAt" DESC)`. Legacy tables whose snapshot column is still `json` or `text` keep the sanitizing path.
