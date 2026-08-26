---
'@mastra/observability': patch
---

Fixed the "Span not found." error when opening the span linked from a log or metric in Studio.

Logs and metrics emitted inside an internal or excluded span were stamped with that span's own id. Those spans are dropped before export, so the id referenced a span no exporter ever received, and clicking through from a log detail panel returned a 404.

Logs and metrics now resolve to the nearest ancestor span that actually reaches exporters, and omit `spanId` entirely when no such ancestor exists. This applies to newly emitted signals; already-stored logs and metrics keep the ids they were written with.
