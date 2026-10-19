---
'@mastra/core': patch
---

Server model usage telemetry now counts tokens as model calls finish and reports them every 15 minutes and on shutdown as a new `mastra_model_token_usage_v2` event. Each `mastra_model_token_usage_v2` event contains only tokens the reporting process used, so redeploys, replicas, and lost home directories can't make it resend earlier usage. The startup `mastra_model_token_usage` event is still sent, unchanged, for compatibility, and can still resend earlier usage in those cases. Set `MASTRA_TELEMETRY_DISABLED=1` to turn off telemetry.
