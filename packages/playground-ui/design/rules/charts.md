# Charts and dense data pages

<overview>
Which chart to use, how a chart card is built, how a page full of them is laid out, and how every state looks. Read `core.md` and `page-frame.md` first. A chart is data: every mark on it must stand for a value or a state, and anything that does not is cut. The reference page is Studio's Metrics (`packages/playground/src/pages/metrics/index.tsx`), and the whole-page example is `../examples/pages/requests-dashboard.tsx`.
</overview>

<instructions>

## Pick the chart

```text
One number the user reads first (a total, a rate, a p95)?           -> KpiCard, or MetricsKpiCard when there is no change to show
A value over time
|-- Counts that add up per bucket (requests, tokens, runs)?           -> MetricsStackedBarChart
|   \-- One series only?                                               -> MetricsStackedBarChart variant="capped"
\-- Rates, durations, percentiles, or values that do not add up?      -> MetricsLineChart
Who takes the biggest share of a total (routes, models, agents)?     -> ShareBar
The numbers behind a chart, sortable, one row per series or group?   -> MetricsTable (Sparkline cells for each row's trend)
Flow from one stage to the next?                                     -> SankeyChart
How two measures relate across many items?                           -> ScatterPlotChart
A trend inside a table row or a dense list?                          -> Sparkline
```

- Never stack values that do not sum. Stacked latency percentiles or stacked rates draw a total that means nothing.
- A share of a total is a `ShareBar`, never a pie or donut. A bar ranks and a pie makes the reader compare angles.
- A count is a bar. A line between two counts suggests values between buckets that never existed.

## The chart card

Every chart sits in a `ChartCard` with a `ChartArea` around the chart (both from `@mastra/playground-ui/domains/metrics/components`). Never put a chart in a plain `Card` or a hand-built frame.

- **Header**: the title names what is measured ("Latency", "Busiest routes"), and `total` on the right is the one number the chart sums up to. A card that switches between views of one measure uses `titleMenu`, not tabs.
- **Legend** goes in `toolbar` as `MetricsLineChartLegend`, above the chart. Totals belong in the header, never in the legend. Charts take `showLegend={false}` so the legend renders once.
- **Variant**: `compact` in a grid, so cards in a row share one height; `default` for a card on its own row; `hero` only when the chart is the page's subject, such as an explorer.
- **Axes**: `xLabels="edges"` in a `compact` card, so the first and last time anchor the range without crowding. Format ticks with `axisFormatter` when they need a shorter form than the tooltip; an empty chart's axis never prints a dash.
- **Emphasis**: when one series is the one to read first, such as P95 among percentiles, set `emphasis` on it and on no other.
- **Drill-down**: a chart whose data is browsable elsewhere takes `onBucketClick` and opens that list filtered to the bucket's time window. The card's own link (`href`, or an action such as "View in traces") opens the whole range.

## Color

Charts use the `--chart-*` roles and nothing else. Never borrow a status, badge, or ramp color for a series, and never use a chart role outside data visualization.

```text
What does the series show?
|-- The healthy main measure (requests, runs, tokens)       -> --chart-share-1 (brand green)
|-- A companion beside it                                   -> --chart-share-2 to -5 (cool hues)
|-- A problem (failures, errors, over a limit)              -> --chart-red; a warning is --chart-amber
|-- A quiet reference beside the main one (P99, 3xx)       -> --muted-foreground
|-- Ordered values (low to high, a heat scale)              -> --chart-sequential-1 to -5
\-- One series per model, lab, or entity                    -> --chart-series-{hue}, the same hue for that entity on every chart
```

- Only problems are warm. A red or amber series that is not a failure teaches the reader to ignore red.
- An entity keeps its hue across every chart on the page. A model that is blue in one card and green in the next reads as two models.
- Hues are tuned to one lightness per theme so no series shouts. Never adjust a chart color locally to make one stand out; use `emphasis`.

## Numbers

- Values, axes, and tooltips are the body face with `tabular-nums`, never mono, even for durations (`text.md`).
- Format with the playground-ui formatters: `formatCompactNumber` and `formatCost` from `utils/cost`, `formatDuration` from `utils/duration`, `formatPercent` from `utils/number`. A rate is passed as a ratio (`0.012`), not a percentage.
- When there is no value, show a dash, never `0ms` or `0%` for a reading that was never taken.
- A change badge appears only when both periods have data. A drop from something to nothing is not a `-100%` trend, it is no data. Set `lowerIsBetter` on errors, latency, and cost per unit, so a fall is green.
- `comparison` names the window: "vs previous 24 hours".

## Dense pages

A page that is mostly charts is an index in `page-frame.md` terms: breadcrumbs, one `FilterBar` in `ActionRow.Start` with the time range as its first chip ("Filters" in `page-frame.md`), and the page's one action, if it has one, in `ActionRow.End`, no `PageHeader`, `container` width. The range and every filter live in the URL, and every card on the page reads the same range and filters.

```text
1. KPIs, one row                -> MetricsCardGroup with 3 to 5 KpiCards
2. Charts over time              -> MetricsGrid columns={2} (or 3), each chart a compact ChartCard in MetricsGrid.Item
3. Rankings and breakdowns      -> full-width ChartCard with a ShareBar or MetricsTable
```

- The page body is `grid content-start gap-4 pb-6`. Cards sit directly on the page, 16px apart; never a card inside a card or a section box around a group of cards.
- Pick a column count that divides the number of cards, so the last row is never ragged. Five charts in two columns leaves a hole; give the fifth its own full-width row.
- Columns follow the container (`@container` queries inside `MetricsGrid` and `MetricsCardGroup`), never the viewport, so a sidebar or a split pane does not squeeze cards.
- Order by question: what happened (volume), how well (errors, latency), what it cost, then who caused it (rankings).
- No section headings between the rows. The card titles name each chart; a heading above a grid of titled cards repeats them (`page-frame.md`).

## States

Every state keeps the card's footprint, so nothing on the page moves when data arrives.

| State                          | What renders                                                                                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading                        | `isLoading` on the card and the chart: a ghost of the chart and a skeleton for the total. KPIs take `isLoading`; a `ShareBar` takes `isLoading` and shows skeleton rows                            |
| Updating (new range or filter) | `isUpdating` keeps the previous data on screen, dimmed. Never blank the chart between ranges                                                                                                       |
| Empty                          | `ChartArea isEmpty` keeps the axes and height under one sentence: "No requests in this range." A `ShareBar` takes `emptyState` instead; never wrap it in `ChartArea`, or the message renders twice |
| Error                          | `ChartCardError` inside the same `ChartCard`, so the title and legend stay                                                                                                                         |

A spinner never replaces a chart, and a card never collapses when its data is empty.

</instructions>

<quality-checklist>
- [ ] Each chart type matches the tree: counts that sum are bars, rates and durations are lines, shares are a `ShareBar`
- [ ] Every chart is in a `ChartCard` with `ChartArea`; the legend is in `toolbar` and the total is in the header
- [ ] Series colors come from the color tree; only problems are warm; an entity has one hue across the page
- [ ] Numbers use the playground-ui formatters; empty readings show a dash; change badges only appear when both periods have data
- [ ] The page is KPIs, then a chart grid, then rankings; the column count divides the card count; no headings repeat card titles
- [ ] Loading, updating, empty, and error keep every card's size, title, and legend
- [ ] The range and filters are in the URL, and drill-downs open the filtered list for the clicked bucket
</quality-checklist>
