---
'@mastra/server': patch
'@mastra/client-js': patch
---

Fixed the Evaluate, Review, and Traces tabs staying hidden in Studio when running a custom server. The server now reports observability directly from the Mastra instance via a new `hasObservability` field on the system packages API, so tabs light up without needing the `MASTRA_PACKAGES_FILE` env var that only `mastra dev` sets.
