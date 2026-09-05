---
'@mastra/convex': patch
---

Fixed workflow snapshot upserts overwriting the stored `createdAt`. The Convex server functions now preserve the existing creation time when patching an existing `mastra_workflow_snapshots` row, so a save whose read predated another writer's insert can no longer replace the original timestamp. This keeps `listWorkflowRuns()` ordering and `fromDate`/`toDate` filtering correct, and matches the behaviour of the SQL adapters, whose `ON CONFLICT DO UPDATE` omits `createdAt`.

Deploy your Convex functions to pick up the fix; no application code changes are required.
