---
'@mastra/factory': minor
---

Sessions belong to a factory, not to one repository link.

`source_control_sessions` gains a nullable `factory_project_id` column, a second unique index on `(factory_project_id, user_id, branch)` beside the existing per-link one, and an index on `factory_project_id`. An idempotent backfill in the source-control domain's `init()` fills the column from each session's link and connection, oldest session first; rows whose link no longer resolves, or that would collide with an older session on the same `(factory, user, branch)`, keep a null factory and are counted in one warning. Nothing is dropped and no row is deleted.

A new `source_control_session_repositories` table records one row per `(session, repository link)` with the pushed branch and change request, through `handle.sessionRepositories.upsert` and `listBySession`. Rows go away with the session and when the link is unlinked.

Handle changes: `sessions.create` requires `factoryProjectId` and rejects one that does not match the link's connection; it still reuses a session by `(link, user, branch)`, and a second session with the same `(factory, user, branch)` on another link of the factory now fails with `UniqueViolationError`; `sessions.listByProject({ orgId, factoryProjectId, viewerUserId })` lists a project's sessions across its links; `sessions.getForBranch` accepts either `{ projectRepositoryId, userId, branch }` or `{ factoryProjectId, userId, branch }`. `SourceControlSession.factoryProjectId` is `string | null` and `SourceControlSession.projectRepositoryId` is now typed `string | null` (still written by every entry point). `resolveFactoryProjectForSession` is removed; read `session.factoryProjectId` instead. Session start, PR tools, subscriptions and audit behave as before.
