---
'@mastra/factory': patch
---

Check who sent a GitHub comment or review before letting it wake an agent, and ingest default-branch `push` events.

The sender gate listed event kinds under names the webhook classifier never produces, so the identity check that keeps untrusted commenters from waking Factory agents was skipped for every comment and review event. The gate now names the kinds the classifier actually emits. Separately, `push` events were dropped by the event filter before ingestion; they are now ingested and forwarded to Factory's event pipeline so downstream consumers (such as the upcoming warm base-checkpoint refresh) can observe default-branch pushes.
