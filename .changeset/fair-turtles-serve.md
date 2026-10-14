---
'@mastra/core': patch
---

Server model usage telemetry now counts tokens as model calls finish and reports them every 15 minutes and on shutdown as a new `mastra_model_token_usage_v2` event. Each process reports only the tokens it used, so redeploys, replicas, and lost home directories no longer resend earlier usage. The startup `mastra_model_token_usage` event is still sent for compatibility. Set `MASTRA_TELEMETRY_DISABLED=1` to turn off telemetry.
