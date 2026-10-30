---
'@mastra/playground-ui': minor
---

Unified metrics chart card headers on one style: a medium-weight title with the card's total on the right. Descriptions, labelled summaries, card tabs and numbers in chart legends are gone; a card with several views switches them from its title.

**Breaking: removed**

- `ChartCard` props `description` and `summary`. Use `total` (and `isLoading`).
- `MetricsCard.Description`, `MetricsCard.TitleAndDescription`, `MetricsCard.Summary`, `MetricsCard.Tabs`, `MetricsCard.Tab`, and `MetricsCard.Title`'s `weight` prop (titles are always medium).
- `aggregate` on `MetricsLineChartSeries` and the `data` prop of `MetricsLineChartLegend`.
- `MetricsKpis`.

```tsx
// Before
<ChartCard title="Latency" description="Duration percentiles." summary={<MetricsCard.Summary value="4.6s" label="P95" />}
  toolbar={<MetricsCard.Toolbar><MetricsCard.Tabs value={view} onValueChange={setView}>…</MetricsCard.Tabs></MetricsCard.Toolbar>}>

// After
<ChartCard title="Agent latency" total="4.6s"
  titleMenu={{ value: view, onValueChange: setView, options: [{ value: 'agents', label: 'Agent latency' }, …] }}>
```

**Added**

- `ChartCard` `variant="hero"` and `MetricsCard.Headline`, for one large chart that is the page's subject: a label over a large total, the change against the previous period beside it, and controls on the right.
- `total` can take one value per series (`[{ label, value, color }]`), each after a marker in its series' color, for a card charting a few different things. Resources and threads uses it.
- `AgentRunsCard` switches to Failure rate from its title (`onViewErrors`, `onFailureTimeRangeClick`).

**Changed**

- Chart cards in a grid row end at the same height, and their charts line up in every state (loading, empty, error).
- On ranges that start and end at the same time of day (last 24 hours, 3 days, 7 days), small charts label their ends by date alone ("Oct 28", "Oct 29"), and those labels reach the plot's edges.
- A chart's tooltip stays above the chart cards that follow it on the page.
- "View in traces" buttons use the Traces icon, card action buttons are smaller and line up with the title, and a card's title menu closes once a view is picked.
- A series with a single point gets a dot; other series draw lines only.
