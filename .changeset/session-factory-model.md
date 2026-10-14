---
'@mastra/factory': minor
---

**Sessions belong to a Factory.** A session now records the Factory it belongs to, not only the repository link it was created on. This is groundwork for sessions that span every repository in the Factory environment.

- List every session of a Factory the caller can see, across all source-control providers, with `GET /web/factory/projects/:id/sessions`. The sidebar, search and board use it instead of one request per repository.
- `sessions.create` on the source-control handle now requires the Factory and rejects one that does not match the repository link.

```ts
// Before
await sourceControl.sessions.create({ sessionId, projectRepositoryId, orgId, userId, branch, baseBranch });

// After
await sourceControl.sessions.create({
  sessionId,
  projectRepositoryId,
  factoryProjectId,
  orgId,
  userId,
  branch,
  baseBranch,
});
```

**Upgrading:** existing sessions are assigned their Factory on the next start. A session whose repository link no longer exists, or that holds the same branch for the same user as an older session on another repository of the Factory, stays unassigned. Unassigned sessions don't appear in the Factory session list, and Slack replies in their threads skip Factory model defaults. Continue that work in a new Slack thread or a new session. A board run that would reuse one fails with an error naming the session to delete before retrying.
