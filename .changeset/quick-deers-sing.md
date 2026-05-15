---
'@mastra/server': minor
---

Added stored-entity HTTP surface for agents, skills, and workspaces.

- New CRUD + publish/activate/restore handlers for `stored-agents`, `stored-skills`, and partial `stored-workspaces` updates, with response shapes enriched by favorite counts and the caller's `isFavorited` flag.
- New favorite handlers under `/stored/agents/{id}/favorite` and `/stored/skills/{id}/favorite` (PUT/DELETE) and shared favorites-enrichment helpers used by the list/get responses.
- New authorship helpers (`getCallerAuthorId`, `resolveAuthorFilter`, `assertReadAccess`) that gate visibility on `authorId` + `visibility` for both stored agents and stored skills.
- New `editor-builder` schemas/handler that resolves the active builder's model policy and picker visibility from the configured `IMastraEditor`.
- New avatar validation (`validateMetadataAvatarUrl`) and a `resolveBuilderModelPolicy` utility that wraps `builderToModelPolicy` from `@mastra/core/agent-builder/ee`.
- `handleError` now maps `ModelNotAllowedError` (from `@mastra/core/agent-builder/ee`) to HTTP 422 with a structured JSON body containing `code`, `attempted`, `offendingLabel`, and the configured `allowed` list.
- Test-utils route suites updated for the new routes and to skip the favorite + role-permissions endpoints in adapter conformance tests.
