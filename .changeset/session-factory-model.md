---
'@mastra/factory': minor
---

Sessions now belong to a Factory rather than to one repository link, so a session can span every repository in the Factory environment.

- `source_control_sessions` gains `factory_project_id`, filled by an idempotent backfill on init. Nothing is dropped or deleted.
- New `source_control_session_repositories` table records the branch and change request a session has per repository (`sessionRepositories.upsert` / `listBySession`).
- `sessions.create` requires `factoryProjectId`; `sessions.listByProject` lists a Factory's sessions across its links; `sessions.getForBranch` accepts `{ factoryProjectId, userId, branch }`.
- `SourceControlSession.factoryProjectId` replaces `resolveFactoryProjectForSession`.
