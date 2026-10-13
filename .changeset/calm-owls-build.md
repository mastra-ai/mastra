---
'@mastra/factory': minor
---

Added environment builds. When the Factory sandbox implements the `builds` capability, Factory builds the environment template ahead of sessions instead of on the first session boot.

- `POST /web/factory/projects/:id/environment/build` starts a build now (the Environment page's **Build now** button, or `mastra api factory project environment build <project-id>`).
- `GET /web/factory/projects/:id/environment/builds` and `GET /web/factory/projects/:id/environment/builds/:buildId` read the provider's build history and live status.
- The environment payload carries `buildTriggers`: a cron schedule and a push trigger with a debounce window.
- Scheduled and push builds skip when the last build is ready and nothing it was built from changed. Only one build starts at a time, and no trigger starts a build while the last one is still running. Saving settings never starts a build.
- Hosts that spread `prepare()`'s result into `new Mastra` pick up the `factory-environment-build` workflow.
- After a session's own setup, each repository link records `configured` or `failed` with the redacted error.

Turn on a nightly rebuild and push builds for a project:

```ts
await fetch(`${baseUrl}/web/factory/projects/${projectId}/environment`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    buildTriggers: {
      schedule: { enabled: true, cron: '0 3 * * *', timezone: 'UTC' },
      push: { enabled: true, debounceMinutes: 10 },
    },
  }),
})
```
