# Local telemetry

Mastra Observability stores filtered traces and approved metric samples as spans in the template's local LibSQL database. Use them to inspect latency and failures in the support and review lifecycle.

- **Support:** Authorization, customer-history preparation, policy readiness, Knowledge lookup, missing evidence, and reuse of reviewed findings.
- **Review:** Proposal creation, suspension, resumption, and publication outcomes.
- **Model usage:** Agent, model, tool, and workflow timings, plus token counts and supported cost estimates. A provider error records a failed run.

Stored spans use bounded operation names and outcomes, timestamps, numeric values, and opaque correlation IDs. Metric samples use `metadata.value`, with operation and status in `metadata.labels`. Supported estimates appear in `metadata.costContext`. The exporter filters private prompts, model outputs, credentials, customer identifiers, and Knowledge references out of the persisted records.

To inspect stored data as a local operator, use the application's LibSQL database and the native `listTraces` and `getTrace` methods on `await storage.getStore('observability')`. The configured storage and exporter live in [index.ts](../src/mastra/index.ts) and [observability.ts](../src/mastra/observability.ts).

Run `node --test --test-concurrency=1 tests/integration/demo.test.ts` to verify lifecycle outcomes, usage samples, and redaction against a disposable database and scripted model provider.
