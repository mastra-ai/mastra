---
'mastra': patch
---

The mastra dev and mastra start commands now pass the anonymous analytics ID and command name to the server so aggregated model token usage telemetry can be attributed to the same anonymous install. Opt out by setting MASTRA_TELEMETRY_DISABLED=1.
