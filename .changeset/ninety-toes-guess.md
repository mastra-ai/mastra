---
'@mastra/factory': minor
---

New user sessions are now private by default. Only the person who started a session can open it or see it in session lists; teammates in the same organization no longer see it. Existing sessions keep their current visibility. Factory runs, including runs started from a board card, and Slack channel threads stay visible to the organization.

To create a session the whole organization can open, pass `visibility: 'org'` when creating it:

```ts
await fetch(`/web/source-control/projects/${projectRepositoryId}/sessions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ branch: 'factory/card-7', visibility: 'org' }),
});
```
