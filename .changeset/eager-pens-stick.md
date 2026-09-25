---
'@mastra/core': minor
---

Added an opt-in `summary` flag to `listWorkflowRuns`. When set, storage adapters may return only `{ status, timestamp }` for each run snapshot instead of the full snapshot.

```ts
const { runs } = await workflow.listWorkflowRuns({ perPage: 20, page: 0, summary: true });
```
