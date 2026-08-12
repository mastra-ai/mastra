---
'@mastra/observability': minor
---

Fixed traces created under OpenTelemetry parent spans not appearing in Mastra Studio. Spans now carry a separate `externalParentSpanId` for a parent that comes from an external tracing system, so a run started under an ambient OpenTelemetry span is still recorded as a trace root.
