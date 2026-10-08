---
'@mastra/factory': minor
---

Added a sandbox environment to each Factory project, exposed through one route.

- `factory_projects` gains `sandbox_workdir`, `sandbox_settings`, `workspace_setup_command`, `active_template_id` and `active_template_heads`. Provider settings live in one `sandbox_settings` document holding only the keys the user set and validated by the configured `FactorySandbox`; an unset key leaves the provider's default in place.
- `factory_project_repositories` gains `position`, `in_environment`, `last_build_status`, `last_build_error` and `last_built_at`.
- An idempotent backfill numbers existing links by creation time and marks duplicate repository slugs as outside the environment (oldest link wins). Nothing is dropped or deleted.
- `GET /web/factory/projects/:id/environment` returns `sandbox` (the provider id, the JSON Schema of its settings and its capabilities), the stored `settings`, the workspace setup command and the repositories in position order. `PATCH` on the same path updates them as one unit: `settings` is a partial merged onto the stored document (null removes a key) and rejected with `invalid_environment` when the provider schema refuses it, or with `no_sandbox` when the factory has no sandbox configured; a body that sets positions must list every repository with positions forming a permutation of 1..n.

```json
{
  "settings": { "cpuCount": 8 },
  "workspaceSetupCommand": "pnpm -r build",
  "repositories": [
    { "projectRepositoryId": "…web", "position": 1 },
    { "projectRepositoryId": "…docs", "position": 2, "inEnvironment": false }
  ]
}
```
