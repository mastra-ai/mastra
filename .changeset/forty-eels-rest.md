---
'@mastra/factory': minor
---

Added a sandbox environment to each Factory project: the provider settings a user tunes, the workspace setup command, the working directory and the repositories in the order they are checked out. One route reads and writes it.

`GET /web/factory/projects/:id/environment` returns the provider id, the JSON Schema of its settings and its capabilities (from the configured `FactorySandbox`), the stored settings and the repositories in position order. `PATCH` on the same path updates them as one unit.

```json
{
  "settings": { "cpuCount": 8 },
  "workspaceSetupCommand": "pnpm -r build",
  "sandboxWorkingDirectory": "/home/user",
  "repositories": [
    { "projectRepositoryId": "…web", "position": 1 },
    { "projectRepositoryId": "…docs", "position": 2, "inEnvironment": false }
  ]
}
```

**Settings:** `settings` is a partial merged onto the stored document and `null` removes a key. Only keys the user set are stored; an unset key leaves the provider's default in place. The merged document is validated by the provider schema: a refusal is a 400 `invalid_environment` naming the field and writes nothing, and a factory without a sandbox answers 400 `no_sandbox`. A stored key the current provider does not declare (for example after a provider switch) is dropped and the update retried before it is refused.

**Repositories:** a body that sets positions must list every repository with positions forming a permutation of 1..n. A new link gets the next position; a second link to the same repository slug starts outside the environment.

**Existing projects:** an idempotent backfill on startup numbers existing links by creation time and marks duplicate slugs as outside the environment, oldest link first. Nothing is dropped or deleted.
