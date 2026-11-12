---
'@mastra/pg': patch
---

`listWorkflowRuns` no longer runs a separate count query when a page comes back with fewer runs than requested, so a paginated read such as listing an agent's suspended runs takes one query instead of two. The returned `total` is unchanged.
