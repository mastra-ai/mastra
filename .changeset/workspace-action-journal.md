---
"@mastra/core": patch
"@mastra/libsql": patch
"@mastra/pg": patch
---

Added: Harness storage can now persist workspace action journal rows for desktop policy and action audits.

```ts
await storage.appendWorkspaceActionJournalEntry({
  id: 'workspace-action-1',
  harnessName: 'default',
  sessionId: 'session-1',
  resourceId: 'resource-1',
  threadId: 'thread-1',
  actionKind: 'file',
  operation: 'write',
  action: { kind: 'file', operation: 'write', path: 'notes.md' },
  policyDecision: 'ask',
  policyReasons: ['workspace.default_ask'],
  matchedRules: [],
  createdAt: Date.now(),
});
```

Improved: LibSQL and Postgres adapters now return ordered journal pages for reconnectable desktop audit views.
