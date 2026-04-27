---
'@mastra/core': patch
---

Fixed: `requireApproval` predicate now receives `{ requestContext, workspace }` as the second argument when invoked from the network loop, matching the existing behavior in the agentic-execution path. Function predicates can now gate approval on user role, workspace tier, or other request-scoped state regardless of whether the tool runs in `agent.network()` or the standard agentic loop.

```ts
createTool({
  id: 'delete-account',
  requireApproval: (input, { requestContext, workspace }) => {
    return requestContext.role !== 'admin';
  },
  execute: async () => { /* ... */ },
});
```
