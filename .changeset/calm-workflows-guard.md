---
'@mastra/server': minor
---

Scope dynamic workflow execution and run-control routes to the authenticated definition owner. New runs derive their `resourceId` from request context, client-provided resource IDs can't override it, and cross-owner requests return `404`.

```ts
const workflow = mastraClient.getWorkflow('campaign-workflow')
const run = await workflow.createRun()
```
