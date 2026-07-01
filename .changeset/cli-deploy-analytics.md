---
'mastra': patch
---

Improved anonymous telemetry for `mastra deploy`, `mastra studio deploy`, and `mastra server deploy` so we can spot regressions and measure adoption of the unified deploy path. Events include timing, success/failure, and non-PII flag properties (e.g. whether `--org`, `--project`, or `--env-file` were passed, and whether the command was run in headless mode). The Mastra platform API host is now reported as a coarse label (`cloud` / `staging` / `localhost` / `custom` / `unknown`) instead of the raw hostname, so self-hosted deployments never leak their API URL. Telemetry continues to honor `MASTRA_TELEMETRY_DISABLED`.
