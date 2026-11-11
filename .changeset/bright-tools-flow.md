---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/editor': patch
'@mastra/client-js': patch
---

Add deterministic ToolProvider-backed steps to dynamic workflows. Provider tool entries persist provider, tool, connection, and optional schema snapshots, resolve one OAuth-backed tool per run, and preserve workflow ownership for author-scoped connections.

```typescript
workflow.tool({
  type: 'provider',
  providerId: 'composio',
  toolSlug: 'GITHUB_CREATE_ISSUE',
  connection: {
    kind: 'invoker',
    connectionId: 'github-connection',
    toolkit: 'github',
  },
})
```
