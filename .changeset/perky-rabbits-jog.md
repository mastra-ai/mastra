---
'@mastra/factory': patch
---

- Trigger a fresh review when a push arrives after a pull request review finishes.
- Cancel an in-flight review when a push or Factory bot re-review request supersedes it.
- Route platform-polled `synchronize` and `review_requested` events through the same review rules as direct webhooks.
- Revive subscribed sessions with the persisted owner identified by the subscription session ID.
- Isolate failed subscription deliveries so stale bindings do not replay events or block newer repository activity.

A push or bot request that returns a card from `done` to `review` now runs `factory-rereview`. The skill reconciles the previous review against the pushed commits, checks for newly introduced defects, and reviews the whole pull request again before publishing its verdict. A canceled first-time review still restarts with `factory-review` because it has no completed pass to reconcile.
