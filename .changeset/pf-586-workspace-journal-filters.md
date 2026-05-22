---
"@mastra/core": patch
"@mastra/libsql": patch
"@mastra/pg": patch
---

Added request and affected-path filters when listing Harness workspace action journal entries. Developers can now narrow journal reads to a specific request or exact filesystem path, and can opt in to matching rename or move destinations.

```ts
const requestEntries = await harness.listWorkspaceActionJournalEntries({
  sessionId: "session-1",
  resourceId: "resource-1",
  requestId: "request-1",
  limit: 50,
});

const pathEntries = await harness.listWorkspaceActionJournalEntries({
  sessionId: "session-1",
  resourceId: "resource-1",
  affectedPath: {
    path: "/workspace/src/renamed.ts",
    includeToPath: true,
  },
  limit: 50,
});
```
