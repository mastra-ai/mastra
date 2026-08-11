---
'@mastra/core': patch
---

Fixed traces that start under an OpenTelemetry parent span not appearing in Mastra Studio. Resumed agent and workflow runs keep their link to the suspended run's trace.
