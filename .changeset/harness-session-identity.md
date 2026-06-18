---
'@mastra/core': patch
'mastracode': patch
---

Move the Harness's memory `resourceId` onto the Session as `session.identity`.

In a multi-user host one Harness serves many sessions, so the resourceId — "whose session is this" — belongs to the Session, not the Harness. A new `SessionIdentity` class (`session.identity`) owns it: `getResourceId()`, `getDefaultResourceId()` (the resourceId the session started with, retained across resource switches), and `setResourceId({ resourceId })`. The Session is constructed with `{ resourceId }`, seeded from `config.resourceId ?? config.id`.

The Harness `resourceId` / `defaultResourceId` fields are removed, and the `getResourceId()` / `getDefaultResourceId()` accessors are dropped — consumers read `harness.session.identity.getResourceId()`. `Harness.setResourceId()` stays, since it orchestrates Harness-owned teardown (dropping the current thread subscription, clearing the active thread) before delegating the field write to `session.identity`.

mastracode consumers and tests are migrated to `harness.session.identity.*`.
