---
'@mastra/memory': patch
---

Subconscious now reads its org from an `org:<id>` agent scope on the run it observes. The `organizationId` request-context key still works, alone or alongside a matching org scope. Runs without an org now skip Subconscious quietly instead of reporting an error, since a run scoped only to a user or thread is valid. If a run holds two different orgs (two org scopes, or an org scope that differs from `organizationId`), curation, reminders and the Knowledge tools report an error, and pinned knowledge is skipped for that run.

```ts
await agent.stream('Plan the launch', {
  scopes: ['org:acme', 'resource:user-123', 'thread:conversation-123'],
});
```

Org scopes need a `@mastra/core` release that supports agent scopes and a `@mastra/server` release that reserves `MASTRA_SCOPES_KEY`. Older servers let a request body set that key, so upgrade them together.
