---
'@mastra/core': patch
'@mastra/inngest': patch
---

Encode agent-scoped stream, control, and abort-acknowledgement identities as UTF-8 JSON tuples in base64url so their physical topic names use transport-safe characters, including Google Cloud Pub/Sub's supported charset. Preserve separate identities for each agent/run pair without truncation. Transport resource-length limits still apply: for Google Cloud Pub/Sub, include the adapter's subscription suffix when checking its 255-character limit (the default UUID suffix adds 37 characters).

Custom `shouldCache` predicates receive physical scoped topic names such as `agent.stream.v2.<base64url-tuple>`, not the logical `agent.stream.<runId>`. Prefix checks such as `topic.startsWith('agent.stream.')` continue working; update exact-match predicates to account for scoped names or they will stop retaining replay history.

Route Inngest abort acknowledgements through the `agent-control` Realtime topic on a distinct `agent-ack:` channel, so remote abort requests can receive confirmation without replaying control requests as acknowledgements.

Finish or drain existing runs before upgrading core, server, and Inngest together. Upgraded agents cannot replay legacy raw-topic history; mixed versions cannot observe or abort each other's in-flight runs.
