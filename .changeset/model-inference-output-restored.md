---
'@mastra/observability': patch
---

Fixed model call spans exported with no response. Since 1.23.0, `MODEL_INFERENCE` spans had no output, so exporters that send them as the model call (Langfuse, OpenTelemetry, Datadog, PostHog) showed the prompt but not the model's text or tool calls. These spans now carry the response again, after output processors have run, and their duration still stops when the provider finishes. Fixes [#29818](https://github.com/mastra-ai/mastra/issues/29818).
