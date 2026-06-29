---
'@mastra/inngest': minor
---

Added support for the fine-grained authorization (FGA) `actor` signal on the Inngest execution engine.

Workflows running on the Inngest engine can now pass a trusted `actor` through `run.start()`, `startAsync()`, `resume()`, `stream()`, and `timeTravel()`. The signal is re-threaded across durable step and nested-workflow boundaries, so every nested agent, tool, and memory FGA check sees the same actor. Previously `actor` was only threaded through the default engine, so trusted background workflows on Inngest lost the membership bypass at each step re-entry.

**Usage**

```ts
const run = await workflow.createRun();
await run.start({
  inputData,
  requestContext, // includes organizationId / tenant scope
  actor: { actorKind: 'system', sourceWorkflow: 'nightly-sync' },
});
```
