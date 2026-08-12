---
'@mastra/factory': patch
---

Trigger a fresh review pass when a push arrives on a pull request whose review card already finished Reviewing, and cancel any in-flight review run before dispatching the new one so the superseded pass stops consuming tokens. Re-review from Factory's own bot now also cancels the previous run. The platform-backed polling worker also feeds `synchronize` and `review_requested` events to the factory rules engine, so hosted Factory installations get re-reviews the same way direct-webhook installations do.

A push (or bot re-review request) that returns a card from `done` back to `review` now dispatches the new `factory-rereview` skill instead of `factory-review`. The re-review pass is tuned for its context — reconcile the previous review against the pushed commits, flag defects the push itself introduced, take a fresh sweep over the PR as it now stands, then publish and transition — while running on the same terminal-handoff and untrusted-checkout contracts as `factory-review`. Cancellation and skill choice are decoupled: a superseded first-time review still dispatches `factory-review` on restart (no prior pass to reconcile), only re-entries from `done` get `factory-rereview`.
