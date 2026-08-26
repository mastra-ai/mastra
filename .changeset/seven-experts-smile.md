---
'@mastra/core': patch
---

Fixed stdout log lines carrying a span id that cannot be looked up.

When trace correlation is enabled, `trace_id`/`span_id` are injected into structured stdout logs. A log emitted inside an internal span, or one dropped by `excludeSpanTypes`, was tagged with that span's own id — but such spans are never exported, so clicking through from the logs view found nothing, and the stdout line disagreed with the stored log record for the same event.

Stdout lines now carry the nearest span id that actually reaches exporters, matching the stored record. When nothing in the chain is exportable, the line keeps `trace_id` and omits `span_id` — the trace is still addressable even though no individual span is. `span_id` is now optional on `TraceFields`, so consumers parsing these lines should treat it as possibly absent.
