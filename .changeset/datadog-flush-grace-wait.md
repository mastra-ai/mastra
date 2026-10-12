---
'@mastra/datadog': patch
---

Datadog exporter and bridge `flush()` and `shutdown()` now wait a bounded time (new `flushGraceMs` option, default 2000 ms) for dd-trace's background writer to send LLM Observability spans and evaluations, so short-lived processes that flush and exit no longer lose them.
