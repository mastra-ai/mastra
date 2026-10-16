---
'@mastra/core': patch
'@mastra/observability': patch
'@mastra/client-js': patch
---

Stored spans now keep the parent span ID from your outside tracing system (for example OpenTelemetry) as `externalParentSpanId`. The run still shows as a top-level run in Mastra, and you can now see which runs one outside request started.

A trace with several top-level runs now shows once in trace lists, under its earliest run. When you filter by a value that only a later run has, the trace still shows, under that run.
