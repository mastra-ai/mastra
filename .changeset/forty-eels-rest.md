---
'@mastra/factory': minor
---

Added a sandbox environment to each Factory project, exposed through one route.

- `factory_projects` gains `sandbox_workdir`, `sandbox_cpu_count`, `sandbox_memory_mb`, `sandbox_idle_timeout_minutes`, `workspace_setup_command`, `active_template_id` and `active_template_heads`. Unset CPU, memory and idle timeout leave the sandbox provider's defaults in place.
- `factory_project_repositories` gains `position`, `in_environment`, `last_build_status`, `last_build_error` and `last_built_at`.
- An idempotent backfill numbers existing links by creation time and marks duplicate repository slugs as outside the environment (oldest link wins). Nothing is dropped or deleted.
- `GET /web/factory/projects/:id/environment` returns the resources, the workspace setup command and the repositories in position order. `PATCH` on the same path updates them as one unit; a body that sets positions must list every repository with positions forming a permutation of 1..n.

```json
{
  "sandboxCpuCount": 8,
  "workspaceSetupCommand": "pnpm -r build",
  "repositories": [
    { "projectRepositoryId": "…web", "position": 1 },
    { "projectRepositoryId": "…docs", "position": 2, "inEnvironment": false }
  ]
}
```
