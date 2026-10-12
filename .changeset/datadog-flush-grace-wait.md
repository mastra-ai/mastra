---
'@mastra/datadog': patch
---

Datadog exporter and bridge `flush()` and `shutdown()` now wait a bounded time (new `flushGraceMs` option, default 2000 ms) for dd-trace's background writer to send LLM Observability spans and evaluations, so processes that flush and then call `process.exit()` or get frozen (serverless) no longer lose them. Set `flushGraceMs: 0` to skip the wait.
