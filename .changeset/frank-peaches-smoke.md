---
'@mastra/factory': patch
---

Made Factory session opens and rule-driven kickoffs resilient to platform sandbox failures:

- Skill kickoffs now wait for the agent to accept the wake signal (via the new `requireDelivery` option on `session.sendSignal`) and automatically retry when delivery fails — for example when a platform sandbox is unreachable. Previously kickoffs were marked as sent even when the wake never reached the agent, so review sessions ended up as permanently empty threads.
- Exec calls in the repo materialize/checkout/worktree-setup path retry thrown transport errors with a 5xx status (up to 2 retries with backoff). When several platform sandboxes are provisioned concurrently, the workspace proxy can return a transient 5xx on exec while a VM is still booting; this previously failed the whole session open with "Platform proxy request failed with 500". Command failures are unaffected — they resolve with a non-zero exit code and are never retried.
- A sandbox whose git preflight fails (`git-missing`) is now treated as poisoned: the workspace factory tears it down, clears the persisted binding, and retries once on a freshly provisioned sandbox. Previously a sandbox booted from a bare base image (e.g. when the provider's template build fails) was reattached forever, so every session open failed with "git is not installed in the sandbox".
- Concurrent kickoff preparation no longer surfaces a spurious unique-constraint error: a losing preparer can collide on both the work item's `source_key` and the pending start's `kickoff_key` in sequence, so the insert-or-replay loop now retries once more before giving up.
