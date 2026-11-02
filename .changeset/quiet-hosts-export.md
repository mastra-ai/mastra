---
'@mastra/code-sdk': patch
---

Fixed missing telemetry for Mastra Code mounted on a server-owned Mastra, such as a Factory deployed on Mastra Platform. Without local tracing or Mastra Code cloud credentials, the SDK no longer passes its own Observability into the server's Mastra. That Observability had no working exporter, so it replaced the host's observability and dropped all traces and logs. The host can now set up observability itself, for example through the platform's exporter.
