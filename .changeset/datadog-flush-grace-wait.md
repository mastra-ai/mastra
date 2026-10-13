---
'@mastra/datadog': patch
---

Datadog exporter and bridge `flush()` and `shutdown()` now wait a bounded time for dd-trace's background writer to send LLM Observability spans and evaluations, so a process that flushes and then calls `process.exit()` or gets frozen (serverless) no longer cuts the send off right away. The wait is best-effort: dd-trace gives no way to confirm the request completed. Tune it with the new `flushGraceMs` option (default 2000 ms, `0` disables):

```ts
new DatadogExporter({ mlApp: 'my-app', flushGraceMs: 3000 });
```
