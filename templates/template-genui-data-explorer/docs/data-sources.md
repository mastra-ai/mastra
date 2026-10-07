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
5. Update the Sales-specific guidance in [`src/mastra/agent.ts`](../src/mastra/agent.ts) for the new
   domain. The source descriptor supplies capabilities and examples to the agent automatically.

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
