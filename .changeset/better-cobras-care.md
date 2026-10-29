---
'@mastra/playground-ui': major
---

Unified metrics chart card headers on one style: a medium-weight title with the card's total on the right. Descriptions, labelled summaries, card tabs and numbers in chart legends are gone; a card with several views switches them from its title.

**Removed**

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

**Changed**

- "View in traces" buttons use the Traces icon, and card action buttons are smaller.
