---
'@mastra/core': patch
---

**Fixed:** Closed an authorization bypass where Workflow run resume APIs (`Run.resume`, `Run.resumeAsync`, `Run.resumeStream`, and the evented `EventedRun.resume`) executed persisted snapshots without an internal FGA check. The same `workflows:execute` permission that gates `Workflow.execute` now also gates every resume path, so callers reaching the core API directly (or any handler that skips the built-in server route adapter) cannot continue a suspended run that the configured FGA provider would deny.

When no FGA provider is configured, behavior is unchanged. When FGA is configured and no authenticated user is available, resume now fails closed with the same `authenticated user is required` error the initial execution already raised.

Bug report: https://github.com/mastra-ai/mastra/issues/18165
