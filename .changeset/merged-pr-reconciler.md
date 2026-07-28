---
'@mastra/factory': patch
---

Added a periodic merged-PR reconciler so review board cards can never get stuck when a merge event is missed. Every 5 minutes (while platform GitHub polling is enabled) the event worker lists still-open `github-pr` review cards, fetches the live pull request state from GitHub, and replays a missed merge through the normal rules ingress with a state-derived idempotency key — moving the card to Done (and notifying an active session, if any) exactly once. Sweep failures are logged and stay on cadence instead of retrying every poll tick.
