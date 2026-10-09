---
'@mastra/factory': minor
---

Added a sandbox environment to each Factory project. Provider settings, the workspace setup command, the working directory and the order repositories are checked out in now live on the project and are read and written through one route, `GET` and `PATCH /web/factory/projects/:id/environment`.

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

**Settings:** only the keys you set are stored; anything unset keeps the provider default. A patch is merged onto the stored settings, `null` removes a key, and the result is checked against the provider's schema before anything is written. A rejected value answers 400 `invalid_environment` naming the field; a factory without a sandbox answers 400 `no_sandbox`.

**Repositories:** to reorder, list every repository with positions 1 through n. A second link to the same repository starts outside the environment.

Existing projects keep working: their links get an order on the next start and nothing is deleted.
