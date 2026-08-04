---
'@mastra/otel-bridge': patch
---

Fixed the OpenTelemetry bridge ignoring a span's explicit start time, which would report wrong durations for spans created after the work they represent began (such as provider tool call spans).
