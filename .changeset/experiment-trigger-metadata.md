---
'@mastra/server': patch
---

Fixed `POST /datasets/:datasetId/experiments` silently discarding `name`, `description` and `metadata`. The request schema left the fields out, so they were stripped during validation and the experiment was created with those columns empty even though the request returned 200. They are now accepted and stored, matching what the experiment read routes already return.

```jsonc
// POST /datasets/<id>/experiments
{
  "targetType": "workflow",
  "targetId": "my-workflow",
  "name": "Nightly baseline",
  "metadata": { "model": "claude-haiku-4-5" }, // before: dropped, now: stored
}
```
