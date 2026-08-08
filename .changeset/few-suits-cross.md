---
'@mastra/otel-bridge': patch
---

Fixed workflow traces breaking apart after suspend and resume when using OtelBridge. A resumed workflow run now continues the trace that was persisted when the run suspended: the bridge parents the resumed span under the original trace using a remote OpenTelemetry span context, instead of ignoring the restored IDs and starting a brand-new trace. This restores the trace continuity introduced in #12276 for setups that route spans through OpenTelemetry. Fixes [#20771](https://github.com/mastra-ai/mastra/issues/20771).
