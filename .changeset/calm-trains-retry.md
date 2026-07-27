---
'@mastra/factory': patch
---

Retry transient sandbox transport failures during repo materialization and worktree setup. When several platform sandboxes are provisioned concurrently, the workspace proxy can return a transient 5xx on exec while a VM is still booting; this previously failed the whole session open with "Platform proxy request failed with 500". Exec calls in the git materialize/checkout/setup path now retry thrown transport errors with a 5xx status (up to 2 retries with backoff). Command failures are unaffected — they resolve with a non-zero exit code and are never retried.
