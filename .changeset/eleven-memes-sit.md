---
'@mastra/core': patch
---

Added model token usage telemetry for serverless servers. `startServerlessModelUsageTelemetry` counts the tokens a request used and reports them as `mastra_model_token_usage_v2` when the request finishes, instead of on a 15-minute timer, so usage isn't lost when a serverless function is frozen or replaced. Reports include a `runtime` property, and `project_id2` is a hash of the platform's project identifier. Long-running servers keep reporting every 15 minutes and on shutdown. Set `MASTRA_TELEMETRY_DISABLED=1` to opt out.
