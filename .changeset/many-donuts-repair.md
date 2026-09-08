---
'@mastra/server': minor
---

Added experiment deletion routes. `DELETE /api/datasets/:datasetId/experiments/:experimentId` deletes an experiment that belongs to a dataset, and `DELETE /api/experiments/:experimentId` deletes any experiment, including orphaned experiments whose dataset was already deleted. Both routes cascade-delete the experiment's results and respect tenancy scoping.

They also delete the traces the experiment produced, cascading to their spans and trace-linked scores, feedback, metrics and logs. Stores without an observability domain (or without tenant-scoped trace deletion) log a warning and skip the trace cascade so the experiment is still deleted.

```sh
# Delete an experiment that belongs to a dataset and tenant
curl -X DELETE 'http://localhost:4111/api/datasets/ds_1/experiments/exp_123?organizationId=org_1&projectId=project_1'

# Delete any experiment, including one orphaned by dataset deletion
curl -X DELETE 'http://localhost:4111/api/experiments/exp_123'
```

Both routes respond `501` unless the installed `@mastra/core` advertises the `experiment-deletion` feature.
