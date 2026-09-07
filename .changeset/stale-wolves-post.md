---
'@mastra/client-js': patch
---

Regenerated route types: workflow step-graph entries now expose optional `id`, `description`, and `metadata` fields.

```typescript
const workflow = await client.getWorkflow("my-workflow").details();
for (const entry of workflow.stepGraph) {
  // id, description, and metadata are now typed on every entry
  console.log(entry.id, entry.description, entry.metadata);
}
```
