---
'@mastra/server': minor
'@mastra/client-js': patch
'@mastra/core': patch
---

**Added** author enrichment to the stored-agents list and get handlers. When an auth provider is configured, each agent record now includes a resolved `author` object alongside the existing `authorId`:

```ts
{
  id: 'agent_…',
  authorId: 'user_…',
  author: { id, name?, email?, avatarUrl? } // new, optional
  // …
}
```

Lookups are deduplicated per request and use the provider's `getUsers` batch method when available, falling back to per-id `getUser` calls otherwise. The field is omitted when no auth provider is configured or the ID can't be resolved, so existing clients keep working unchanged.
