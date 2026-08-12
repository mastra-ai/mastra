---
'@mastra/pg': patch
---

Fixed workflow run lists doing a full table scan on Postgres.

`listWorkflowRuns` orders by `"createdAt" DESC` and filters on `workflow_name` or `resourceId`, but the only index on `mastra_workflow_snapshot` was the primary key on `(workflow_name, run_id)`, which has no `"createdAt"` component. Once one workflow name dominated the table, Postgres fell back to a sequential scan plus a top-N sort — on every call. Studio polls this while a workflow page is open, so an idle browser tab could hold sustained CPU load on a large database.

`@mastra/pg` now creates two default indexes on `mastra_workflow_snapshot`:

- `(workflow_name, "createdAt" DESC)`
- `("resourceId", "createdAt" DESC)`

These are created automatically on `init()` for new and existing tables, and are included in `exportSchemas()` output. Reported in [#21306](https://github.com/mastra-ai/mastra/issues/21306).

Deployments that manage their own indexes can keep opting out with `skipDefaultIndexes: true`:

```ts
const store = new PostgresStore({ connectionString, skipDefaultIndexes: true });
```

**Note on the paginated count:** when `page`/`perPage` are supplied, `listWorkflowRuns` also issues a `COUNT(*)`, which remains O(N) for a dominant `workflow_name` even with these indexes. Making that constant-time needs keyset pagination, which is a separate API change.
