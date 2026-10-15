---
'@mastra/core': patch
---

Fixed model inference spans so they record the messages sent to the model. Observability backends that read the inference span, such as Langfuse through the OpenTelemetry exporter or Datadog, now show the input for every model call instead of an empty value.
