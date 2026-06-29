---
'mastra': patch
---

Track CLI deploy commands in PostHog analytics. `mastra deploy`, `mastra studio deploy`, and `mastra server deploy` now emit `cli_command` events with timing, success/error status, and non-PII flag properties (env name, flag presence, headless mode, target API host). This lets us measure adoption of the unified `mastra deploy` entry point relative to the legacy `studio deploy` / `server deploy` paths. Telemetry continues to respect `MASTRA_TELEMETRY_DISABLED`.
