---
'@mastra/core': patch
---

Fixed tripwire aborts not being captured in OpenTelemetry spans. Processor spans now record tripwire details (reason, retry flag, metadata) when a TripWire error is thrown, and agent-level spans include tripwire information when a processor abort short-circuits the agent run. This makes tripwire-triggered aborts visible in tracing dashboards.
