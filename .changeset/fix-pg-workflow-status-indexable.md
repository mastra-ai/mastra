---
'@mastra/pg': patch
---

Fix `listWorkflowRuns` status filter so it stays indexable on `jsonb` snapshot columns. The filter previously wrapped the column in `regexp_replace(snapshot::text, …)::jsonb ->> 'status'`, which forces a sequential scan (the sanitization is a no-op on `jsonb`, where Postgres already rejects the offending escapes at insert time). The predicate is now chosen by the live column type: `jsonb` uses the plain, indexable `snapshot ->> 'status'`, while `json`/`text` columns keep the sanitizing form.
