---
'@internal/factory': patch
---

Ingest `pull_request.opened` from the Platform event poller so a newly opened pull request mints its Review card. The poller forwards an allow-list of events to the rules engine, and `opened` was missing from it — so on deployments without a direct webhook (the only path a local deployment has), a pull request the factory authored itself was never reviewed.
