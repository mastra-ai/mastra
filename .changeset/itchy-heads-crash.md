---
'@mastra/factory': minor
---

Sessions you create from the sidebar are now named by the server, which counts up forever instead of reusing a number whose session you deleted.

Deleting a session drops its row and its checkout, but not the branch it pushed. Naming the next session off the sessions still in the list therefore handed back a name that was already taken: because session creation is idempotent per branch, the new session landed back on the deleted one's work — silently, on a pooled sandbox that still had the branch checked out, or as a rejected push once the branch had diverged.

`POST /web/github/projects/:id/sessions` now accepts a request with no `branch` and allocates one:

```ts
// before — the caller had to pick a name, with no way to see names already spent
await createUserSession(baseUrl, projectRepositoryId, 'user/session-2');

// after — omit the branch and the server names it
await createUserSession(baseUrl, projectRepositoryId);
```

Passing a branch still works and is unchanged.
