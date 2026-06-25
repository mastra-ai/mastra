---
'@mastra/core': minor
'@mastra/client-js': minor
'@mastra/server': minor
---

Scope harness session creation with tags so sessions sharing a resourceId can
each resume their own thread.

`harness.createSession()` now accepts an optional `tags` record. The tags are
(a) seeded into the new session's state, (b) stamped onto every thread the
session creates (so thread listings can be filtered back to the session's
scope), and (c) used to filter initial thread selection: a thread is a resume
candidate only when its metadata matches every provided tag. Previously, initial
thread selection only consulted the
harness-global `initialState.projectPath`; on a multi-session server (where one
Harness serves many scopes) a session could resume the most recently updated
thread from a *different* scope that shared the resourceId. Using a generic tag
record (e.g. `{ projectPath }`) keeps room for future scoping dimensions without
further API changes.

The `@mastra/client-js` `HarnessSession.create()` method accepts `{ tags }`, and
the `POST /harness/:id/sessions` route accepts a `tags` body field.

```ts
// before: initial thread chosen by resourceId only
const session = await harness.createSession({ resourceId, id, ownerId });

// after: initial thread scoped to this worktree via a tag
const session = await harness.createSession({
  resourceId,
  id,
  ownerId,
  tags: { projectPath: '/repo/worktree-a' },
});
```
