---
'@mastra/factory': minor
---

Environment builds through the FactorySandbox `builds` capability: `POST /web/factory/projects/:id/environment/build` builds the template now, `GET …/environment/builds` and `GET …/environment/builds/:buildId` read the provider's history and live status, and the environment payload carries `buildTriggers` (a cron schedule kept in core `Schedules` and a push trigger with a leading-edge debounce) plus the last build id. A settings change starts a build and the response reports `buildRequested`. A `factory-environment-build` workflow is registered through `prepare()`; hosts that spread `prepare()`'s result into `new Mastra` pick it up. After a session's own setup, each repository link records `configured` or `failed` with the redacted error. The CLI gains `environment build`, `environment builds list` and `environment builds get`.
