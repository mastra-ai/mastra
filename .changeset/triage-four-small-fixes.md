---
'@mastra/core': patch
'@mastra/deployer': patch
'@mastra/pg': patch
---

Four fixes from a triage pass over reported issues.

`@mastra/deployer` now binds the dev server to `localhost` when neither `server.host` nor `MASTRA_HOST` is set. Previously the bind host was left undefined, which Node treats as all interfaces, so a dev server was reachable on the LAN while its startup log advertised `http://localhost`. Set `MASTRA_HOST=0.0.0.0` to keep the old all-interfaces behavior.

`@mastra/core` no longer discards the underlying error when a processor workflow fails. `PROCESSOR_WORKFLOW_FAILED` keeps the original error — or the failed step's error — as its `cause`, so the stack, error type and provider fields stay inspectable.

`@mastra/pg` writes the timezone-aware mirror columns for experiment timestamps. Reads prefer `startedAtZ`/`completedAtZ`, but those were left at their `DEFAULT NOW()`, so experiment results reported insert time instead of their actual run times and could show zero duration.

`@mastra/factory` (unpublished) additionally requires a signed-in user on `/web/fs/list`, `/web/artifacts/list` and `/web/codebase/resolve` when auth is enabled; local factories without auth are unchanged.
