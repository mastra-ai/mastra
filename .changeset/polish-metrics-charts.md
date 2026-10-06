---
'@mastra/playground-ui': major
---

Polished the metrics charts and KPI cards, and added the pieces to build a full metrics page from them: a share list, chart loading ghosts and a card toolbar.

**Charts**

- Stacked bars fade gently toward the base, with 2px gaps between segments, and hovering a column dims the others. Pass `variant="capped"` to `MetricsStackedBarChart` for single-value columns.
- Lines get a faint fill underneath and a dashed hover line. Series take `dashed` (a secondary reading, e.g. an average) and `emphasis` (the one to read first, e.g. P95).
- Small values stay readable: every non-zero bar or stacked segment is at least 3px tall, and zeros draw nothing. A stack keeps its true height by taking the extra pixels from its larger segments.
- X-axis labels sit on round clock times (12 AM, 6 AM, ...) and fit the chart's width, so every chart on a page shares one time grid. Rows carry the bucket's start in `tsMs` (or set `timestampKey`). Pass `xLabels="edges"` to label only the first and last bucket in small cards.
- `height="fill"` grows a chart with its card, so cards in one row end on the same line.
- `isLoading` shows a ghost of the chart (columns or a curve with a light sweeping across) in the chart's own footprint, with the legend in place.
- `onBucketClick` opens a bucket from anywhere in its column, e.g. its traces.
- `MetricsStackedBarChart` takes an `overlay`: one dashed line on its own scale, e.g. average wake time over cold starts.
- New `axisFormatter` (y-axis ticks), `tooltipLabelKey` (a longer tooltip heading than the axis label) and `xKey` on both charts.
- The tooltip formats each series with its own formatter when units are mixed.
- Chart colors are softer and more balanced in dark mode, with a new `--chart-cyan` token.

```tsx
<MetricsStackedBarChart
  data={buckets}
  series={[{ dataKey: 'cold', label: 'Cold starts', color: 'var(--chart-green)' }]}
  overlay={{ dataKey: 'wakeMs', label: 'Avg wake time', color: 'var(--chart-cyan)', valueFormatter: ms }}
  height="fill"
  xLabels="edges"
  showYAxis={false}
  isLoading={isLoading}
/>
```

**Share list**

New `MetricsShareList` ranks rows by their share of a total: one strip on top, the rows below with their share and values. Hovering a segment or a row highlights the pair. Summary cards fold the tail into an "Other" row (`overflow="other"`); long lists page it in with "Show more" (`overflow="more"`). `MetricsShareList.Header` puts the column headers next to a card's tabs.

```tsx
<MetricsCard.Toolbar>
  <Tabs value={tab} onValueChange={setTab}>
    <TabList variant="pill-ghost" size="sm">…</TabList>
  </Tabs>
  <MetricsShareList.Header columns={[{ label: 'Error rate' }]} valueLabel="Runs" />
</MetricsCard.Toolbar>
<MetricsShareList
  rows={agents.map(a => ({ key: a.name, label: a.name, share: a.runs, value: format(a.runs), cells: [a.errorRate], href: a.href }))}
  columns={[{ label: 'Error rate' }]}
  valueLabel="Runs"
  showHeader={false}
/>
```

**Cards and loading**

- New `MetricsCard.Toolbar` for a row of small tabs, a legend or list headers under the top bar.
- `MetricsCard.Actions` takes `reveal="hover"` to show its buttons while the card is hovered or focused.
- `MetricsCard.Summary`, `MetricsKpiCard.ValueRow` and `MetricsKpiCard.Footer` take `isLoading`, with skeletons sized to the real text so nothing moves when data lands.
- New `SkeletonText` (a skeleton in a line of text) and `ChartSkeleton`. Skeletons now animate their shimmer; the animation was missing.
- `MetricsKpiCard.Label` takes an `icon`, and `MetricsKpiCard.Footer` and `MetricsKpiCard.Prev` show a detail line and the prior period's value. KPI cards use the chart cards' padding.
- `MetricsCardGroup` sizes its columns by its own width: four cards share one row from 56rem, five go 3 + 2 and then one row from 72rem.

**Breaking:** `MetricsCardGroup` no longer takes a `variant` prop (the `MetricsCardGroupVariant` type is removed), and `MetricsLineChart` no longer takes `xAxisInterval` or `xAxisMinTickGap`: labels are placed for you, or pass `xLabels="edges"`.

```tsx
// Before
<MetricsCardGroup variant="inset">{cards}</MetricsCardGroup>
<MetricsLineChart data={data} series={series} xAxisInterval="preserveStartEnd" xAxisMinTickGap={40} />

// After
<MetricsCardGroup>{cards}</MetricsCardGroup>
<MetricsLineChart data={data} series={series} />
```
