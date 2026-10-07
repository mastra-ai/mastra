# Data sources

The included source keeps setup small so you can focus on generative UI. It uses synthetic SaaS
Sales data in a local SQLite database. You can replace it with your own data source or combine this
UI approach with other Mastra templates for deeper data exploration.

## The sample data

`npm run dev` creates `.data/sales.sqlite` on its first run. The dataset contains opportunities,
accounts, sales representatives, and subscription history across the preceding 24 complete UTC
calendar months. Later starts reuse the same data and dates. Relative questions such as “last month”
refer to the saved dataset's latest complete month, not a moving live feed. Dates outside its coverage
are reported as unavailable.

The source supports:

- **Bookings:** closed-won contract value, including monthly trends and comparisons by segment,
  region, owner, or stage. In this example, “sales” means bookings.
- **Conversion and growth:** closed-deal win rate and bookings growth against matching earlier-year dates.
- **Pipeline and forecast:** open opportunity value at a date and an illustrative weighted forecast.
  Forecasts are scenarios, not guaranteed revenue.
- **Customer and revenue churn:** losses relative to opening customers or monthly recurring revenue.
- **Customer cohorts:** retention and cumulative churn by first activation month. Retention ends at
  the first full cancellation; later reactivation is separate.

Amounts are stored as USD cents and displayed as USD. Opportunity metrics support the advertised
segment, region, owner, and stage filters; subscription churn and cohort metrics do not use those
filters. Monthly churn uses each month's opening population, so monthly rates should not be added
or averaged into a whole-period rate.

The source calculates values; the agent chooses supported analyses and views. Open **Source details**
on a card to read its metric definition. The default app stores data and conversations locally for
single-user use.

## Connect your own source

Start with [`data-sources/source.ts`](../data-sources/source.ts). Its `DataSource` interface has
three methods:

| Method                      | Responsibility                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `describe()`                | Advertise the source, date coverage, metric definitions, units, filters, groupings, and example requests. |
| `execute(request, context)` | Read the source and return an `AnalysisResult` for the supported request.                                 |
| `close()`                   | Release connections and other resources.                                                                  |

1. Implement the adapter under `data-sources/<your-source>/`. Use
   [`data-sources/sales/source.ts`](../data-sources/sales/source.ts) as the working example.
2. Register its `id` and `open(settings)` function in
   [`data-sources/sources.ts`](../data-sources/sources.ts). Set `defaultSourceId` to that ID, or select
   it with `SOURCE_ID` in `.env`.
3. Replace the Sales path settings passed in [`src/mastra/index.ts`](../src/mastra/index.ts) and
   [`scripts/launch.ts`](../scripts/launch.ts) with the settings your adapter accepts. Keep credentials
   on the server.
4. If the source needs preparation, add it in [`scripts/sources.ts`](../scripts/sources.ts).
   Remove the Sales-specific preparation when replacing that source; keep setup code under `scripts/`.
5. Declare domain guidance in your source descriptor’s `instructions`, and supply capabilities,
   display metadata and example requests. These reach the agent and UI automatically.

Results include the executed request, values and units, calculation operands, completeness, and
source provenance. Optional tables declare typed columns and their shape: series, ranked data,
records, or a matrix. Return actual read-operation provenance, respect cancellation and read limits,
and report unavailable or incomplete data explicitly. See the schemas in `data-sources/source.ts`
for the full contract and [`src/analysis/verification.ts`](../src/analysis/verification.ts) for validation.

Your source owns its metric IDs and definitions; it does not need to reproduce Sales metrics or use
SQLite. Match its result roles and units to the [UI catalog](ui-components.md), then check the adapter
with known inputs and expected outputs under `tests/`.

## Go deeper with other Mastra templates

For broader database querying, document retrieval, or file ingestion, adapt the relevant tools and
workflows from these templates:

| Template                                                                             | What to reuse                                                                                                         |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| [Chat with Database](https://github.com/mastra-ai/template-text-to-sql)              | Database schema discovery and natural-language SQL queries.                                                           |
| [Chat with PDF](https://github.com/mastra-ai/template-chat-with-pdf)                 | PDF indexing, retrieval, and answers with page citations.                                                             |
| [CSV to Questions Generator](https://github.com/mastra-ai/template-csv-to-questions) | Reading CSV files, summarizing their contents, and generating exploration questions.                                  |
| [Organization Intelligence](https://mastra.ai/templates/organization-intelligence)   | Cited answers from local files, Google Drive, and S3-compatible storage, including Markdown, PDF, and DOCX documents. |

These are integration starting points, not preinstalled connectors. For structured analytics, adapt
their results to the `DataSource` contract so this template can validate and render them. Document
passages and citations need their own result contract and UI component; they do not fit the current
numeric metric contract directly. See [Adding UI components](ui-components.md) for the catalog and
agent selection guidance.

## Use another domain without changing the UI

The shared agent, renderers and workspace actions read the selected source's contracts. Sales
terminology, business guidance and fixed filter choices live in the Sales adapter. An education
adapter can advertise `enrollments` in `students` and `completion` in `percent` using the same UI.

For example, this capability enables a daily enrollment chart, course rankings, filtering,
comparison and record inspection:

```ts
{
  metric: "enrollments",
  description: "Count of enrolled students in the requested period.",
  presentation: { label: "Student enrollment" },
  unit: "students",
  calculation: "total",
  fields: ["period", "filters", "groupBy", "records"],
  filters: ["course"],
  filterControls: [{
    field: "course", label: "Course", type: "string",
    options: [{ label: "Mathematics", value: "math" }, { label: "History", value: "history" }],
  }],
  groupings: [
    { field: "teachingDay", kind: "series", interval: "day" },
    { field: "course", kind: "ranked", drillFilter: "course" },
  ],
}
```

Return a typed `date` grouping column for the daily series, or a `category` column for the ranking,
plus the numeric `value` column with unit `students`. Grouped rows carry `numerator` and
`denominator`; totals equal the numerator and reconcile to the sum of rows. Rates use `percent`
and verified numerator/denominator operands. Arbitrary free-form documents and unverified values
remain outside this numeric analytical contract.

- `presentation.label` names the metric. `presentation.scenario: true` requires the composed
  view to identify a scenario, regardless of the metric ID. `presentation.note` supplies a
  source-owned explanation. Verification attaches these fields from the registered capability;
  the model cannot override them.
- `filterControls` defines labels, types (`string`, `number`, `boolean`) and optional labelled
  values. Numeric, boolean and explicit null options retain their types. A missing control falls
  back to a text input. Filter and comparison actions accept only the selected metric's declared
  filters; undeclared fields and invalid declared types/options are rejected server-side.
- `groupings[].interval` identifies daily or monthly series and their record drill windows.
  `drillFilter` maps a ranked category to a supported filter. Without either mapping, the UI
  does not offer record drill-down. The source must also advertise `records`.
- Matrix tables declare distinct `axes.x`, `axes.y` and numeric `axes.value`. Axes may use any
  supported column type. The renderer reads their labels and coordinates, and displays the metric
  unit. Cohort matrices additionally set `cohort: true` in both the grouping and table; this retains
  the stricter complete-month/fixed-population validation used by the Sales adapter.
- Optional `recordCount: { field, equals }` reconciles a percentage's record numerator to matching
  rows and its denominator to the full record count.

Put domain-specific analysis guidance in the descriptor's optional `instructions`, and useful
questions in `examples`. Both reach the agent automatically; the welcome screen uses the source
title and examples. The source still owns metric calculations, supported questions and data access.
A new domain requires an adapter and registration, not edits to presentation components.

`tests/fixtures/education-source.ts` is an independent in-memory example used by integration and
browser tests. It demonstrates daily trends, rankings, categorical matrices, percentages, numeric
and boolean filters, comparisons, record drill-down and saved conversations. It is a test fixture,
not a preinstalled production education connector.
