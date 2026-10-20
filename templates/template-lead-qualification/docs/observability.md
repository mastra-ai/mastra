# Reports and telemetry

`src/mastra/observability/` contains aggregate reports, telemetry, evidence diagnostics, evaluation, and maintenance. Operational records live in `data/application.db`; native Mastra traces, logs, and metrics live in `data/observability.duckdb`.

## Query business results

Request `/lead-qualification/report?from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z`. Production requires the same bearer token as run reads. `from` is inclusive, `to` exclusive; windows are at most 90 days, with an optional `limit` of 1–1,000 assessments.

The report includes enrichment coverage, classification and score distributions, uncertainty, automatic/human authorizations, and overrides. Conversion appears only when a mapped sales source supplies matching Won/Lost outcomes. Qualification alone isn't a sale.

Results cover retained records. Truncation and expired markers are reported; removed detail can't be reconstructed by selecting a longer window. Adapt calculations in `observability/reporting.ts` to your business definitions.

## Adapt technical measurements

`observability/telemetry.ts` uses Mastra's native exporter. It records allowlisted lifecycle codes, correlation IDs, provider duration, and measured token usage. Unknown usage stays unknown. Traces strip bodies, prompts, excerpts, arbitrary metadata, and error detail. Operational assessments still contain source material.

Add explicitly allowed fields when extending diagnostics. Telemetry failures expose `telemetryDegraded` without replaying business work. Cost is unavailable unless you supply versioned `telemetryPricing` to `createApplicationRuntime`; that estimate covers configured text-token rates only, excluding search and other charges.

## Evaluate a customized policy

`observability/evaluation.ts` compares imported assessments against independently labeled identity, attributes, classification, score, disqualifiers, and citations. Semantic reviews check unsupported summary claims. Use your own dataset and the exported schemas to prepare labels and observations:

```bash
npm run eval -- --labels expected.json --observations observed.json --output report.json
```

The command performs no research. Controlled fixtures establish functional behavior; model observations describe only the evaluated dataset. Keep private evaluation inputs outside the template. [Maintenance](operations.md#maintenance) manages retained detail and telemetry.
