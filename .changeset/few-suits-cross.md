---
'@mastra/otel-bridge': patch
---

Fixed workflow traces breaking apart after suspend and resume when using OtelBridge. A resumed workflow run now continues the OpenTelemetry trace it started in instead of starting a brand-new one, even when the resume happens in a different process. This restores the trace continuity introduced in #12276 for setups that route spans through OpenTelemetry. Fixes [#20771](https://github.com/mastra-ai/mastra/issues/20771).
