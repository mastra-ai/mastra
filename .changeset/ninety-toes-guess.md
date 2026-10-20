---
'@mastra/factory': minor
---

Sessions opened with **New session** are now private. Only the person who started one can open it or see it in session lists; teammates in the same organization don't see it. Every other session, including Factory runs started from a work item, stays visible to the organization.

The session create route takes an optional `visibility` (`'org'` by default, or `'private'`):

```ts
await fetch(`/web/source-control/projects/${projectRepositoryId}/sessions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ sessionId, title: 'Fix the login bug', visibility: 'private' }),
});
```
