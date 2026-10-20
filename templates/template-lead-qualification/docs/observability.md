# Persistent observability

Operational events, run associations and Mastra workflow snapshots live in `data/application.db` through LibSQL. MastraCompositeStore routes the observability domain to native DuckDB at `data/observability.duckdb`; MastraStorageExporter writes traces, safe application logs and native technical metrics there. Both files are local, persistent and ignored by Git. Use one application process per directory.

The `lead-intake` workflow is visible in Studio after submission through the event API. Studio traces and logs support technical inspection. Intake status is available through its bounded read endpoint. Qualification scores and review/output state are available from authoritative operational records through the run endpoint. No conversion report or automatic business KPI dashboard is provided.

The output processor removes span inputs, outputs, arbitrary attributes, request context, tags, links, free-form names and error details before metrics/export. Traces retain safe types, timing, generic error information and validated run UUIDs. Framework log forwarding is disabled because external errors may contain private content. Application diagnostics use an explicit code/UUID schema and the native exporter. Contact data and raw accepted events stay in the operational database, which must be protected and backed up accordingly.

Research failures in the persisted assessment may include a `provider` diagnostic: the search, extraction or verification stage, an allowlisted response status and incomplete reason, HTTP status, known error classification, bounded validation issue codes and allowlisted field paths, and nonnegative token counts. Failed structured JSON may be validated transiently in memory to recover issue paths; values and messages are discarded. Raw provider messages, bodies, headers and URLs are excluded. Incomplete responses and invalid structured output have distinct failure codes. Observed output usage settles the shared allowance even on failure; without measured usage, the full reservation remains charged. A failed discovery can still analyze previously validated source material within the remaining shared budget, retaining the discovery failure.

Research round journals and assessments may also include optional `discoverySelection` diagnostics. Each round retains at most 32 candidates in discovery order, plus `omittedCount`. `providerIndex` identifies the configured provider. `priority` is the existing URL relevance score; `rank` orders safe candidates by that score and citation preference before exclusions. `selectionRank` is the actual retrieval order among approved, distinct, supported, unconsulted URLs. `selected` marks a retrieval attempt, with a fixed `reason` for retrieval success, unavailability, duplicate, unsupported format, prior consultation, unapproved source, selection stopping after success, or budget exhaustion. Ties retain discovery order. Ranks apply within each provider response.

Candidate URLs contain only a public DNS HTTPS host and path prefix, capped at 512 characters. Query strings and fragments are removed. Invalid, local, special-use, credential-bearing and non-HTTPS URLs become `null`; unsafe URL text is discarded. This syntactic diagnostic filter does not resolve hosts; the existing approval, DNS and retrieval checks remain authoritative. The diagnostics retain no raw responses, page text or model reasoning, and never feed research prompts or change selection. Existing journals without this optional field remain readable.

Telemetry failure never authorizes or replays work. Diagnostic submission failures emit a fixed warning; `telemetryDegraded` on the run endpoint exposes degradation detected by the application. It is a process health hint, not proof that every export succeeded. Graceful shutdown stops dispatch, flushes observability, closes native stores and releases DuckDB's file lock. Forced termination can lose buffered telemetry; acknowledged operational associations remain recoverable.

Use the operator-only [retention preview/apply](retention.md) with the process stopped. DuckDB pruning is independent from operational cleanup and cannot remove pending review/output state.

Customization prompt:

> Extend technical observability for [safe event] using the existing native Mastra exporter and composite storage. Add only explicitly allowed codes, bounded numeric fields and validated correlation IDs. Keep private content, secrets, raw bodies, prompts and contacts out of traces/logs/metric labels. Test persisted DuckDB records, operational separation, export failure isolation and reopen persistence. Update this guide without promising automatic business KPI charts.

## Inspect technical measurements

Each completed OpenAI attempt records observed input/output/reasoning tokens when supplied and measured provider duration in milliseconds. The native exporter stores allowlisted `research.measurement` logs and `lead_research_*` metric events in DuckDB. A stable usage ID and deterministic metric IDs identify one attempt; retries are separate attempts. Shared budget counters remain conservative operational reservations and must not be presented as measured usage. Unknown token counts are nullable in the log and produce no fabricated zero-valued metric.

Safe lifecycle logs identify entity resolution, retrieved material, fact/scoring results, review preparation and applied output with validated IDs, classification, score and policy version. Native span filtering retains only these safe correlation fields and removes bodies, prompts, excerpts, arbitrary attributes, errors, tags, links and previews. Invalid telemetry data degrades telemetry without changing qualification or settlement. Submission failures are isolated from business work; the degraded flag cannot prove all queued exports succeeded.

Cost is unavailable by default. Set `telemetryPricing` on `createApplicationRuntime` to opt into an explicitly partial text-token estimate with a versioned configuration:

```ts
telemetryPricing: {
  version: 'openai-standard-2026-10-19',
  model: 'openai/gpt-6-luna',
  inputPerMillion: 0.10,
  outputPerMillion: 0.50,
  assumption: 'standard_uncached_text_tokens_only',
}
```

These [GPT-6 Luna Standard rates](https://developers.openai.com/api/docs/models/gpt-6-luna) were checked on 2026-10-19. The estimate assumes uncached standard text input, excludes tool/search and other charges, and is explicitly partial rather than a billed amount. Cached input, regional pricing, Batch/Flex/Fast tiers and long-context pricing differ. Unknown usage, a mismatched model, absent pricing or input above 272000 tokens returns unavailable. [Web search pricing](https://developers.openai.com/api/docs/pricing) includes a separate tool charge and search-content tokens. Reconcile actual billing externally; do not infer a complete zero-cost run from missing telemetry.

## Query retained business results

GET `/lead-qualification/report?from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z` uses the same production authentication as the run API. `from` is inclusive, `to` exclusive, the window is at most 90 days, and `limit` is 1–1000 assessments. The report identifies truncation, earliest retained detail and observed expired markers. A 90-day request cannot recreate details already removed after 30 days. Historical completeness is always explicitly false; expired counts are retained marker coverage, not a census after markers themselves expire.

Leads enriched counts accepted company attributes (business model, workforce or headquarters), excluding inquiry-only enrichment. Coverage counts accepted requested attributes over all four requested attributes. Classification, original score bands (0–39,40–69,70–79,80–100) and uncertainty use the immutable assessment. Qualification/manual-review rates use completed assessments. Policy authorization and human authorization are separate; Nurture follow-up is not an uncertainty review. Applied SDR disposition overrides retain their reason without changing the original score/classification.

Conversion is available only with the configured separate sales-outcome source and a matching applied assessment/cycle. For each pair the latest observed Won/Lost event before `to` wins, with stable event-ID tie-breaking. Duplicate/reordered observations cannot inflate the denominator. Each original score band reports Won, Lost, sample denominator, rate and open-or-unobserved applied assessments. Without a mapped source or matching closed outcome, rate is null and availability explains why. Qualification, publication and automatic authorization never imply a sale. A later sales close belongs to its original applied assessment's score band. Retained-cohort results can change when evidence/outcome records expire.

The JSON report is the business KPI surface. Native Studio activity, usage, duration and trace inspection do not automatically create business KPI cards. For measurement methodology see [evaluation](evaluation.md).
