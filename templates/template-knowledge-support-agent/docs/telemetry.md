# Support telemetry

Mastra Observability stores traces in the application database. It uses the local database by default and the configured database in hosted deployments. Use traces to see which steps took time or failed.

- **Support** records access checks, case history and Knowledge lookups, and reuse of reviewed findings.
- **Review** records when a proposal starts, waits for a decision, and is published or rejected.
- **Model usage** includes timings, token counts, and cost estimates when available.

The exporter filters out private prompts, model replies, credentials, customer IDs, and Knowledge references before saving traces.

To read the data in code, get the observability store with `await mastra.getStorage()?.getStore('observability')` and call `listTraces` or `getTrace`. Metric samples are stored as point events in those traces. [Exporter configuration](../src/mastra/observability.ts)
