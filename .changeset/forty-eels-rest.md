---
'@mastra/factory': minor
---

Store the sandbox environment on the Factory project and expose it through one route.

`factory_projects` gains `sandbox_provider`, `sandbox_workdir`, `sandbox_cpu_count`, `sandbox_memory_mb`, `sandbox_idle_timeout_minutes`, `workspace_setup_command`, `active_template_id` and `active_template_heads`. `factory_project_repositories` gains `position`, `in_environment`, `last_build_status`, `last_build_error` and `last_built_at`. An idempotent backfill in the source-control domain's `init()` numbers existing links by creation time, marks duplicate repository slugs as outside the environment (oldest link wins) and copies the oldest link's provider and workdir onto the project. Nothing is dropped and session boot does not read the new columns yet.

`GET /web/factory/projects/:id/environment` returns the resources (defaults of 4 cpus and 8192 MB applied on read), the workspace setup command and the repositories in position order. `PATCH` on the same path updates them as one unit:

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

Positions must be a permutation of 1..n over the listed repositories. The CLI route metadata includes the new route.
