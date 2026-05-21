---
'@mastra/core': patch
'mastra': patch
---

Fixed MASTRA_TELEMETRY_DISABLED to accept common truthy values (true, yes, on) in addition to 1. Previously, only the exact value 1 disabled telemetry in @mastra/core, so setting MASTRA_TELEMETRY_DISABLED=true still sent data to PostHog. Now all three telemetry integration points (core, CLI, and Studio) consistently recognize 1, true, yes, and on as disabled.
