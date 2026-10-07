# GenUI Data Explorer

GenUI Data Explorer explores structured data through natural-language questions and interactive
visual answers. A Mastra agent selects registered charts, tables and metric cards through CopilotKit,
so users can compare results, inspect records and refine their analysis with follow-up questions. Sales is the included
sample domain; the focus is generative UI for data exploration.

## Why we built this

Data exploration involves moving between questions: a trend leads to a comparison, a comparison
leads to individual records, and each answer suggests what to examine next. Generative UI can make
that exploration conversational, with the agent choosing a useful view for each question and
preserving context as the user follows up.

The Sales example provides concrete questions about pipeline, conversion, growth, and
churn. The same approach could be adapted to other domains:

- **Finance:** compare spending across departments and inspect the transactions behind a variance.
- **Product:** explore feature adoption, compare usage across cohorts, and inspect activity trends.
- **Operations:** track order fulfillment, compare locations, and investigate delayed deliveries.
- **Education:** compare course participation and inspect completion trends across learner groups.

These are adaptation ideas, not bundled datasets or supported analyses. Each needs its own data
source and metric definitions.

**Current status:** the local browser workspace uses the official CopilotKit/AG-UI Mastra integration,
verified Sales analytics, configurable React views and durable local conversation/workspace
storage. This candidate has not been accepted or published in the Mastra template catalog.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set server-side `OPENAI_API_KEY` in `.env`.
  Interactive questions use `openai/gpt-4.1-mini` by default; `ANALYSIS_MODEL` accepts another OpenAI
  model ID available to the account. Provider usage starts only when a question is submitted.
- A checkout containing `templates/template-genui-data-explorer`. Catalog scaffolding with
  `npx create-mastra@latest --template template-genui-data-explorer` remains unavailable until publication.
- A writable `DATA_DIRECTORY` (default `.data`) for Sales, workspace and Mastra conversation SQLite
  files. `AGENT_PORT` (4111) and `WEB_PORT` (3000) must be distinct available local ports.
- Data commands and deterministic tests need no provider credentials or external database service.

## Quickstart 🚀

1. **Open the candidate template**
   - From the existing checkout, run `cd templates/template-genui-data-explorer`, then `npm install`.
2. **Configure the model**
   - Run `cp .env.example .env` and fill in the key described under Prerequisites.
3. **Start the local workspace**
   - Run `npm run dev`. The launcher initializes the example dataset once, starts both local
     services and stops them together on exit. Anonymous Mastra/Next/CopilotKit telemetry is disabled.
   - Open [the workspace](http://127.0.0.1:3000), ask “Show monthly bookings over the last twelve
     complete months”, and inspect the agent-selected trend or table and verified source explanation.

## Try it out

The conversation fills the workspace width. Each accepted answer renders registered cards under the
question that created them, with formatted USD values and calendar dates. Technical calculation
evidence stays on the server; **Source details** exposes the
metric definition when needed.

- Use **Dark mode** or **Light mode** in the header. The dark palette is inspired by Dracula; the choice persists in this browser.
- Use **Collapse** and **Expand** to fold a card while keeping its question and answer together. This changes only the current presentation and makes no model call.
- Hover a chart point or select its month/category button to see its value. **Inspect selected records**
  opens the underlying rows. Registered React renderers own these interactions.
- **Correct this view** opens a dismissible feedback panel above the chat input.
  Describe the interpretation to change, then choose **Apply correction** or press Enter. The reason is sent directly as a chat request; the accepted correction replaces that card without editing source records.
- Unsupported and failed questions show a visible response beside the attempted question. The last
  accepted cards remain available.

- Ask for monthly bookings, then select SMB in the card's segment filter. The server recomputes
  the filtered totals and series before replacing that card.
- Choose **Compare Enterprise**. A second card preserves the original and exposes the comparison's
  own filters and provenance.
- Use **Inspect** beside a month or category in the accessible table to read the underlying closed
  opportunity records. Records and grouped values reconcile to the published aggregate.
- **Back to overview** restores the saved chart, period and filters after inspection without a model call or another source read. The return view survives reload/restart; an inspection saved by an older version may not have an overview to restore.
- Ask for a ranked segment comparison or closed-opportunity records. The agent selects a different
  registered composition; unrelated cards remain available.
- Reload the browser or stop and restart `npm run dev`, then follow up on the previous analysis.
  Accepted cards, filters and conversation context are restored without another model request.

## Customization

- Open the project in your coding agent and describe an adaptation: “Adapt this data explorer for
  order fulfillment. Define the data and metrics needed to explore delivery times by location,
  and make GenUI switch between trends, comparisons and order details. Explore the code and propose
  a plan before making changes.”
- Replace the source registration under `data-sources/`, or configure/extend the component catalog
  and React renderers under `src/ui/`. The registration contracts below describe both paths.

## Native runtime and analytical authority

`npm run dev` launches the native Mastra server and Next.js together. Open
[Mastra Studio](http://127.0.0.1:4111) to inspect **Data Explorer**, its **analyze** and **compose** tools,
the **grounded-analysis** workflow and local traces. Studio is an inspection surface; submit questions
through the Next workspace so the server can resolve saved history, filters, source and revision.
Raw native generate/stream/workflow/tool execution and memory mutations are disabled. Framework
public auth endpoints have no configured auth provider and cannot create accounts or sessions.
The services bind to loopback and do not provide public deployment or multi-user authorization.

`src/mastra/index.ts` exports the actual registered `mastra` instance. Agent/tool construction is in
`src/mastra/agent.ts`, workflow execution in `src/analysis/workflow.ts`, and connector authority checks
in `src/analysis/verification.ts`. `createExplorer()` in `src/analysis/create.ts` offers the same
bounded analytical engine to server-side consumers with explicit registered sources/models.
Run `npm run build`, then `npm start` for the built native server and Next production application.
The launcher still initializes data automatically and preserves existing accepted state.

The stream reports planning, validation, reads and verification before one terminal outcome. Completed
facts include request, workspace, trace, workflow run, query and result IDs; source/dataset/metric
versions; effective requests; completeness and calculation checks; and the SQL and bound parameters
actually executed by SQLite. Explanations are composed from verified operands, so model prose cannot
introduce unverified numbers. Relative periods use the saved dataset clock; unsupported historical
coverage returns an unavailable result instead of invented zero sales. Descriptive facts cannot
establish why a change occurred.

Each workspace allows one active analysis. Runs have at most eight combined model/tool steps,
1,024 generated tokens per model response, a five-second read deadline, a 60-second overall deadline,
and limits of 1,000 returned records across all collections and 1 MiB per source result. Only explicitly retryable read errors can retry,
once within the original read deadline; paid model calls never automatically retry. Incomplete,
malformed or oversized connector data cannot become verified totals. SQLite reads run in disposable
processes: cancellation/deadlines kill the process and await its close before releasing the workspace.
Other adapters must honor `context.signal`; a remote adapter that ignores it may still run remotely,
but its late output is discarded. Cancel a streamed request by disconnecting its client.

Successful results remain available through `DataExplorer.lastComplete(workspaceId)` in the current
process, including after later failures. The browser workspace additionally commits accepted facts,
components and context durably with revision checks.

## Configure registered views

`src/ui/catalog.ts` is the shared declaration surface: each entry declares its stable ID/version,
enabled flag, semantic kind, data roles, compatible units, supported actions, Zod properties schema
and defaults. Only enabled entries appear in the agent's serializable catalog. The analyze tool exposes verified role, typed columns, grouping key, matrix axes and units without raw rows.
Server-owned accepted-card IDs, versions and bindings are supplied as bounded context for refinement
after reload or restart. Server composition
validation resolves every result ID against verified results and checks roles, units, axes, sorted
dates and forecast labels. Client messages and state cannot add tools, authorize SQL or publish facts.
After analysis, the compose tool schema constrains result IDs, enabled renderer versions and axes to
the verified results. Line/bar bindings omit the heatmap value axis; final server validation still applies.

Change `enabled` or `defaults.pageSize` in the declaration to remove a view or configure its table.
To add a view, extend the catalog with its schema and add the corresponding React entry in
`src/ui/renderers.tsx`. The disabled `compact` example has its own `options.emphasis` enum and
comparison action; enable it to use that renderer. Generic orchestration needs no new component
switch. Increase the declaration version when its saved property contract changes.

Grouped source tables may name their grouping column with `grouping`; without it, exactly one
date column (series) or category column (ranked) must identify the group. Chart axes and accessible
drill controls resolve that same source-owned binding, so column names are replaceable.

Cohort matrices have explicit source-owned `axes: { x, y, value }`: x is an integer month age,
y is a cohort date, and value is a percentage column. The heatmap binds exactly those keys. Matrix
validation rejects duplicate coordinates, missing observed ages, future ages, changing cohort sizes
and a period-end rate that does not reconcile to the final cohort observations. A table can display
the same matrix as an alternative. Heatmap clicks and keyboard cohort/month selectors inspect the
verified cell without replacing the overview or calling the model.

Charts use verified source series, with explicit zero bookings months; conversion months without
closed deals are gaps. Tables retain all available columns, paginate locally and provide keyboard
controls. Money is stored as safe integer USD cents and formatted as USD in visible tables/charts.
Forecasts are illustrative scenarios and never guaranteed revenue. Invalid compositions preserve
the last accepted workspace. A removed or changed renderer gets a compatible verified table fallback
when available; accepted original bindings remain stored for recovery after configuration is restored.

## Replace the data source

`data-sources/source.ts` defines shared Zod schemas and the read-only `DataSource` contract:
`describe()`, `execute(request, context)`,
and `close()`. Each source declares its own metadata, version, coverage, capabilities, accepted fields
and filters, and example requests. Grouped capabilities declare `groupings` entries with a bounded
source-owned `field` and `kind: "series" | "ranked" | "matrix"`; unsupported groupings fail before any read. Descriptors declare the metric version; capabilities must have unique IDs and
explicit `calculation: "total" | "percentage"` semantics. Percentage capabilities use percent units;
total capabilities use non-percent units.
Metric IDs are source-owned strings; a custom source does not
need Sales metrics, SQLite, or an example dataset. Results contain a value, units, numerator and
denominator where relevant, an unavailable reason, the executed request, and source/dataset/metric
provenance. Optional details carry the Sales example's rows, forecast assumptions and churn breakdowns.
Each available result includes actual redacted `provenance.operations` with `kind`, `statement` and
`parameters`. SQLite records SQL; non-SQL connectors describe their own read operations without
fabricating SQL. Unsupported coverage may honestly return no executed operations.
`provenance.asOf` describes dataset freshness; historical snapshot dates and applied filters remain
in the cloned `result.request`.

Implement your source under `data-sources/<your-source>/`, then replace the explicit registration in
`data-sources/sources.ts` and its `defaultSourceId`. Runtime and setup share these registrations;
`scripts/sources.ts` adds optional operational preparation. For example, after implementing `CustomSource`:

```ts
import { CustomSource } from "./custom/source.ts";

export const defaultSourceId = "custom";
export const sources: readonly SourceRegistration[] = [
  {
    id: "custom",
    open: async (settings) => {
      return new CustomSource(settings);
    },
  },
];
```

Keep the `OperationalSource` declaration and `prepareSource` helper in `scripts/sources.ts` when adapting its
registration; the example above replaces only the registration section. Settings are a source-owned
record rather than a mandatory database path. The CLI's optional `--path` setting is interpreted by
Sales; a replacement source defines and validates its own configuration. Add an optional `prepare`
callback only if your source needs setup. Keep that operational preparation under `scripts/`.
`data:init` prepares only the explicitly selected enabled source; `data:inspect` opens it read-only,
executes its declared examples, and releases resources even when execution fails. Neither command
initializes or opens unselected or disabled Sales registrations. Unknown, removed, disabled and
duplicate source IDs fail explicitly, with no automatic fallback.

The generic registry and inspection consumer under `data-sources/` have no Sales or script imports.
`data-sources/sources.ts` is the shared runtime registration point. `scripts/sources.ts` adds CLI
preparation, while the analytical runtime consumes registrations without importing operational scripts. After replacing the registration, you can remove
`data-sources/sales/` and the unused Sales initialization/generation/schema scripts, plus their
Sales-specific tests. The generic CLI does not contain a Sales switch or a fixed Sales report.
`tests/fixtures/reference-source.ts` demonstrates a non-SQL replacement in tests without shipping
another production connector.

The delivered source and analytical paths cover selection, metadata/capabilities, validated read-only
requests, normalized verified results, actual operation provenance, bounded execution and resource
ownership. Remote production connectors remain an adaptation task.
The connector contract rejects incomplete pagination rather than publishing partial totals.

## Sample dataset

On first initialization, the dataset covers the **24 complete UTC calendar months preceding that
run**. A first run on October 4, 2026 produces `[2024-10-01, 2026-10-01)`, with an as-of date of
September 30. The current partial month is excluded. Metadata persists the exact first-run anchor,
seed, USD currency, UTC timezone, schema, generator, and metric versions. Later runs reuse these
values before consulting the wall clock, even when another seed is supplied. The default seed is
1729; the programmatic initializer permits an unsigned 32-bit seed for a new file.

The included names and records belong to the example dataset. The source contains 432 opportunities, six representatives,
120 accounts, multiple regions and segments, and opening subscription balances before the first
reported month. Every month includes won/lost deals, open pipeline, and effective history. The same
seed, anchor, and version reproduce the same logical facts; binary file identity is not the
reproducibility contract.

## Metric contract

“Sales” in the included example means **bookings**, the contract value of closed-won opportunities.
For example, ask “Show a chart of last month sales”, “Compare bookings by segment over the last twelve
complete months”, or “Show the same analysis for SMB”. The agent selects supported requests and
registered views; the source performs the calculation. Wording and view selection can vary, while
identical effective requests must produce the same verified facts.

Customer and gross revenue churn support whole-period rates and calendar-month trends. Ask
“Show monthly customer churn for the last 12 complete months” or “Chart gross revenue churn by month”.
Each monthly row uses its own opening population. A month without opening customers or MRR is a gap,
not a zero rate. Rates are never added or averaged to derive the whole-period churn rate. Monthly
requests require complete calendar-month bounds within the saved source coverage. The monthly view
can remain available even when the whole-period opening population is empty.

Charts use Apache ECharts with tooltips, zoom, keyboard point selection, responsive sizing and
animations that respect reduced-motion preferences. Verified tables remain available below the chart.
Customer cohorts use each account's first positive combined subscription MRR to determine its first
activation month. Their size stays fixed. **Continuous retention** ends permanently at the first
complete account cancellation; later reactivations are reported separately. Month 0 is the end of
the activation month, so it may already be below 100%. Same-day subscription transfers are atomic.
Accounts activated before the selected cohort period do not enter its cohorts. Blank cells represent
ages not observed before the requested exclusive end, and months without new activations have no cohort.

Ask “Show a customer retention cohort heatmap for the last 12 complete months”, “Show a cohort chart
of customer churn for the last 12 complete months”, or “Show retention cohorts in a table”.
`cohortRetention` returns retained customers / fixed cohort size; `cohortChurn` returns customers with a
first complete cancellation / that same size. The overall rate uses all selected cohort members at
the requested period end; it does not average matrix cells or compare cohorts at equal ages. The
heatmap supports tooltips and cell selection, retaining its overview. Opportunity segment filters,
revenue-retention cohorts and causal explanations are outside these subscription capabilities.
A cohort heatmap requires a source-owned matrix; an aggregate cannot satisfy that request.

Dates use start-inclusive/end-exclusive periods, except an as-of date includes its entire UTC day.
Opportunity snapshots retain the stage, contract value, expected close, owner, and segment known on
their effective date. Region is a fixed account attribute in this dataset. Money uses integer USD
cents. Unsafe integer totals fail explicitly. Filters accept owner ID, segment, region, and stage;
booking/conversion filters use the closing snapshot, while pipeline/forecast filters use the as-of
snapshot. Subscription metrics do not support opportunity filters. Monthly churn uses opening populations;
activation-cohort retention/churn uses the fixed members activated in the selected period.

| Metric                  | Definition                                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bookings                | Contract value of closed-won deals in the period, counted once. This is not MRR or recognized revenue.                                                                                                                                                  |
| Conversion              | Closed-deal win rate: won / (won + lost).                                                                                                                                                                                                               |
| Sales growth            | (Comparison bookings − baseline bookings) / baseline bookings. Defaults to matching dates in the previous year; a supplied earlier-year baseline must match the same calendar boundaries.                                                               |
| Pipeline                | Open opportunity values reconstructed as of the requested date.                                                                                                                                                                                         |
| Forecast                | Open deals with expected close in the horizon, using the stage known as of that date. Qualification 10%, discovery 25%, proposal 50%, negotiation 75%. Round the aggregate to cents once. Booked amounts known as of that date are reported separately. |
| Customer churn          | Starting active accounts reaching zero total MRR during the period / starting active accounts. Multiple subscriptions do not count as multiple customers.                                                                                               |
| Trailing customer churn | The same starting-cohort calculation over 12 months; monthly percentages are never added.                                                                                                                                                               |
| Revenue churn           | Gross subscription cancellation/contraction losses in the opening account cohort / opening MRR. Each account's cumulative counted loss is capped at its opening MRR. New accounts and expansion do not increase the loss allowance.                     |

Opening balances use events strictly **before** period start. Start-day events count, end-day events
do not. Same-day subscription changes are applied together when deciding whether an account
churned. A starting customer is counted only on its first full cancellation, even after later
reactivation; reactivated customers are reported separately. Revenue churn measures gross losses,
so a subscription cancellation still counts when another subscription expands that day. For
same-day losses competing for the account cap, cancellation receives the available cap before
contraction. The cancellation-only breakdown uses that same cap.

Ratios expose numerator and denominator. A zero denominator produces an unavailable result with
an explanation and the absolute values. Missing historical coverage produces unavailable values,
never fabricated zeros. Matching-year shifts clamp leap-day boundaries to valid calendar dates.
Use full month boundaries for year comparisons when possible. Forecasts may extend past observed
coverage, but use only open facts already known; these fixed weights are illustrative scenarios,
not calibrated probabilities or guaranteed future bookings. No future actual outcomes are implied.

## Programmatic use

```ts
import { initializeSales } from "./scripts/initialize.ts";
import { openSales } from "./data-sources/sales/database.ts";
import { bookings, pipeline } from "./data-sources/sales/opportunity-metrics.ts";
import { trailingCustomerChurn } from "./data-sources/sales/churn-metrics.ts";

await initializeSales(".data/sales.sqlite");
const { db, metadata } = openSales(".data/sales.sqlite");
try {
  console.log(bookings(db, metadata, metadata.coverage));
  console.log(pipeline(db, metadata, metadata.asOf));
  console.log(trailingCustomerChurn(db, metadata));
} finally {
  db.close();
}
```

Operational entry points, initialization, schema creation, and example generation live under
`scripts/` at the template root. Generic source contracts/selection/inspection live under
`data-sources/`; the Sales read-only access, calendar, metric definitions and adapter live under
`data-sources/sales/`. Runtime source code does not depend on operational scripts.

`openSales` opens a read-only connection with extension loading disabled. The separate initializer
owns all writes. Do not pass untrusted database paths or expose the SQLite handle to an agent. The
Sales adapter validates its advertised typed requests, rejecting unsupported or extra fields rather
than silently ignoring them. The analytical workflow enforces execution budgets and deadlines;
Sales native reads run in disposable processes for actual deadline/cancellation termination.

## Persistence and recovery

The launcher stores `sales.sqlite`, `workspace.sqlite`, `memory.sqlite`, `telemetry.sqlite` and
`traces.sqlite` beneath `DATA_DIRECTORY`. Sales, workspace, conversation, domain diagnostics and native
traces use separate access paths. Analytical reads can access only Sales.
The workspace transaction saves verified results, bindings, filters, drill context, conversation and
revision together with its request journal. Mastra Memory/LibSQL stores conversation separately;
accepted workspace messages reconcile that store before generation and after each run. An interrupted
or failed attempt cannot become accepted conversation truth. Startup/reload restores without invoking
any model. Source, dataset and metric versions must match saved provenance before reuse.

Requests bind an ID to their question, base revision and typed interaction. An identical replay reads
its journal without another model call; reusing the ID with different input fails. A valid newer
interaction cancels and awaits the older analysis; stale output cannot replace the newer revision.
Failed saves and interrupted runs remain explicitly incomplete while the previous accepted revision
stays visible. Retry with a new request ID after restoring service or write permissions. Do not delete
stores to conceal an error. The local demo uses one fixed workspace, thread and server-owned identity;
it is not a multi-user deployment or an authentication system.

The saved workspace is bounded to 24 cards and 1 MiB; remove a card, reuse card IDs or request fewer records if that
budget is reached. HTTP accepts only local Hosts/same-origin browser requests, bounded 2 MiB uploads
and fixed loopback upstreams. Provider keys never enter client bundles, messages or source operations.

Initialization builds a uniquely reserved temporary file in one transaction, validates it, closes
it, and syncs it before publishing with an atomic no-overwrite hard link. A competing initializer
reuses the winner's complete metadata. Publication therefore requires a filesystem supporting
same-directory hard links. Existing canonical files are never overwritten or deleted.

Corrupt, incomplete, incompatible, symlink, and non-file canonical paths fail with preservation and
recovery guidance. Fix permissions or free space, then retry. To start another dataset, choose a
new empty path. To explicitly replace one, stop readers, back up and move the old file first.
There is no automatic destructive reset or migration. A process crash can leave a `.pending` file;
it is never accepted as the canonical dataset. After confirming that initialization has stopped,
abandoned temporary files may be removed manually. A normal failed attempt removes only its own
reserved temporary file.

## Development checks

```bash
npm run format:check
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:workspace
npm run standalone:prepare
npm run test:quality
npm run build
```

Use `npm run format` to apply oxfmt formatting. All configuration and dependencies are local to
this template. Strict TypeScript covers application code, operational scripts, and tests. `typecheck` includes the React/Next application. The build compiles the Next production application and
bundles the native Mastra server to `.mastra/output/` and
emits runtime modules to `dist/src/`, source adapters to `dist/data-sources/`, and operational scripts
to `dist/scripts/`, excluding tests.
All test setup, fixtures, and test configuration are under `tests/`. Plain Vitest
tests verify data calculations, dataset persistence and real Mastra agent/tool/workflow execution
with a deterministic model provider. Integration proofs include native SQLite cancellation,
connector recovery, local HTTP streaming and the four native browser journeys. Chromium for Playwright
can be installed with `npm exec -- playwright install chromium` when it is not already available. The official `@mastra/evals/vitest` reporter and `expectEvals(...).toPass()`
assertions execute eight independent analytical cases and reject a deliberately regressed fixture; no live or paid model evaluations run in these checks. The HTTP proof needs permission
to open a loopback listener in restricted environments.

## Dependency licenses

The data layer uses Node.js standard libraries (Node.js MIT; bundled SQLite public domain).
`@mastra/core` and `@mastra/evals` (Apache-2.0) use `"latest"` in `dependencies`, following the Mastra
template contribution convention. The analytical runtime uses Mastra agents, tools, workflows and
RequestContext; tests use the official eval assertions and reporter. The native CLI (`mastra` 1.32.1)
and local observability (`@mastra/observability` 1.18.3) use Apache-2.0 and declared `latest` ranges.
The lockfile pins core 1.74.0 and evals 1.10.5 for reproducible installation. Zod 4.6.4 (MIT) is the direct shared schema
dependency. The lockfile isolates Zod 3.25.76 for the older AI SDK utilities under Mastra Client; application schemas remain on Zod 4. Development dependencies are TypeScript 5.9.3 (Apache-2.0),
Vitest 4.1.0, `@types/node` 24.19.1, and oxfmt 0.71.0 (MIT). The standalone NPM lockfile records exact
resolved versions for all packages; `npm ci` reproduces those versions.
CopilotKit, AG-UI core/client, React and Next use MIT licenses. The Mastra AG-UI adapter, RxJS,
Mastra client, Memory and LibSQL integrations use Apache-2.0. Playwright and TypeScript are Apache-2.0; React
type declarations are MIT. Apache ECharts 6.1.0 uses Apache-2.0; its zrender 6.1.0 dependency uses
BSD-3-Clause, and tslib uses 0BSD. See the lockfile and installed package license metadata for exact
transitive dependencies.

The analytical runtime factory is `createExplorer()` in `src/analysis/create.ts`. It resolves the registered
source once, registers the actual Mastra agent/workflow, and accepts a developer-configured model.
Requests cannot override source IDs, database paths, identity, model or budgets. The guarded workspace
requires JSON and rejects foreign Origins and nonlocal Hosts before any model execution.

A replacement adapter must return the executed request and matching source, dataset, metric and clock
provenance. Capability-bound schemas verify the declared calculation: totals have no denominator and
use safe integer numerators; percent ratios also expose a nonnegative safe integer
denominator and compute `numerator / denominator × 100`. Zero denominators return an unavailable
value with a reason. Grouped percentages default to partition reconciliation; declare
`groupedCalculation: "independent"` for observations with distinct opening populations. Every row still
requires verified calculation operands, and independent series require unique ordered dates inside
the requested period. The generic workflow validates schemas, identity, versions, periods, filters,
units, completeness and calculation operands before publishing facts. All record collections share
the row budget. Explanations use checked operands and trusted versioned capability descriptions;
result-supplied narrative assumptions are excluded from verified result details. Other detail values
remain source data and cannot be rendered as checked explanatory prose. Return `complete: false` for
partial pagination, never a full aggregate. Throw `SourceError(code, safeMessage, retryable)` for typed
failures; only transient `rate-limit`/`source-unavailable` reads may retry. Keep credentials out of
messages and operation evidence. Implement deadline/cancellation handling and resource cleanup in
the adapter. The independent non-SQL fixture under `tests/fixtures/` proves the same public path;
it is contract evidence rather than a bundled CRM integration.

## Evaluation reports and optional benchmark

`npm run test:quality` is a check-only harness for a prepared standalone extraction. First run
`npm run standalone:prepare`: it copies the template outside the checkout and runs `npm ci` using
that copy's manifest, lockfile and cache. The subsequent quality check never installs dependencies.
It runs independent NPM type/unit/integration/format/build checks, asserts that an intentionally
failing official Mastra eval exits nonzero, then starts the real native server and Next browser with
an offline OpenAI-compatible provider. The browser proof covers distinct trend/ranking/record views,
configuration correction/retry, saved state, local trace redaction and shutdown. Browser binaries
must already be installed. Refresh the extraction after changing source or the lockfile. A file fingerprint rejects stale copies;
credential environment files and native-generated editor settings are excluded. Native check builds inspect configuration with disposable generated stores, remove them afterward, and set `MASTRA_BUILD_SKIP_INSTALL=1`
and resolve only the prepared template dependencies.

The mandatory deterministic report is `.data/quality-report.json`. It records actual applicable
counts, failures, model/corpus/dataset metadata for eight dimensions: query semantics including
joins; exact money/counts and ratios within 0.01 percentage points; provenance; suitable views;
axes/units/completeness/scenario labels; filtered cohorts; paraphrase equivalence; and unsupported
claims. Controlled providers test these contracts without certifying unrestricted model quality.

`npm run benchmark:live` is separate from startup and required checks. It sends the versioned
24-question corpus once per case, sequentially, including four paraphrase pairs. Before invoking it,
verify the exact model's current official pricing and provide these environment values:

```dotenv
BENCHMARK_APPROVED=true
BENCHMARK_CAP_USD=<your explicit spending cap>
BENCHMARK_INPUT_USD_PER_MILLION=<verified positive input rate>
BENCHMARK_OUTPUT_USD_PER_MILLION=<verified positive output rate>
BENCHMARK_PRICING_MODEL=gpt-4.1-mini
BENCHMARK_PRICING_VERSION=<your dated pricing record>
BENCHMARK_PRICING_VERIFIED_AT=<UTC YYYY-MM-DD within seven days>
BENCHMARK_PRICING_REFERENCE=https://openai.com/api/pricing/
```

The command refuses zero/unknown/stale/model-mismatched prices and any cap below its conservative
input/response/step envelope before making a paid call. The actual model adapter enforces that
input-byte, response-token and call envelope. There are no automatic paid retries. An outage or
exhausted envelope stops the corpus and reports remaining cases as skipped, never passed.
Estimates are distinct from provider billing. The live numeric oracle is the deterministic adapter
reference; independent semantic truth is covered by the mandatory hand-authored fixtures.
The live report is `.data/live-benchmark.json`, limited to its recorded model/corpus/seed/pricing.
All applicable hard checks must pass; suitable views and equivalent questions require at least 90%.
No paid benchmark result is claimed by deterministic fixture tests.

## Local diagnostics and operations

Run `npm run diagnostics` to summarize `telemetry.sqlite`. A failed diagnostic write emits one sanitized warning and cannot undo an accepted workspace transaction. Query success uses successful executed
reads divided by read attempts, while validation rejects are separate. Visualization usage counts
committed views by type. Follow-up rate uses threads with a follow-up divided by started analytical
threads. Unsupported counts explicit unsupported outcomes; correction rate uses accepted corrections
divided by completed analyses. Choose **Correct this view**, edit the reason and ask a follow-up
that replaces its accepted card ID. Failed or rejected corrections preserve the accepted revision
and do not increment that counter.

Time to first insight ends at the first browser render acknowledgement for a current persisted,
verified result. The server validates request/result/revision binding, timestamps reception and
deduplicates acknowledgements. It does not use a client-supplied duration or first token. Restored
cards do not repeat model calls. Unknown token usage and cost are unavailable, rather than zero;
ordinary-use cost is unavailable because no current pricing table is silently assumed.

Domain events correlate request/workspace/thread, analysis trace, workflow/run, query/result and
source/dataset metadata. They contain validated plans, redacted operation evidence and outcome
categories, never prompt text or full rows. Native spans retain timing/hierarchy and allowlisted
correlation/usage metadata after a processor removes input/output/request-context payloads and
error details before the local storage exporter. No hosted exporter is configured.

Missing keys, invalid enabled source/view selections, occupied ports and storage failures identify
corrective actions. Fix `.env` or registration/configuration and rerun the launcher; no reset is
required. `SOURCE_ID` optionally selects an enabled registered source, and `UI_COMPONENT_IDS` can
select unique registered component IDs; clear either setting to restore defaults.
`ANALYSIS_BASE_URL` optionally selects a trusted server-side OpenAI-compatible endpoint.

Stop services before maintenance. Back up accepted data before changing `sales.sqlite`,
`workspace.sqlite` or `memory.sqlite`. To discard only diagnostic history, move `telemetry.sqlite`
and `traces.sqlite` (plus any SQLite sidecars) after shutdown; the next launch creates fresh journals
without reseeding Sales or deleting accepted work. Local history has no automatic retention policy.
Do not delete data or workspace stores to conceal errors.

## About Mastra templates

This project is a candidate contribution for Mastra templates, focused on generative UI for data
exploration with Mastra and CopilotKit. Official acceptance and catalog publication remain subject
to maintainer review.

[Want to contribute?](./CONTRIBUTING.md)
