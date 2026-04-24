---
'@mastra/playground-ui': minor
---

Added optional interactivity props to the metrics chart primitives so cards can turn data points into links without wrapping or reimplementing the components. All additions are opt-in; existing call sites render identically.

- `MetricsLineChart` accepts an `onPointClick` callback that fires with the clicked point and series key.
- `HorizontalBars` accepts a per-row `href` (the whole row becomes a link) and a per-segment `hrefs` array (individual segments become links).
- `MetricsDataTable` accepts a `getRowHref(row)` function that turns each row into a link when it returns a URL.
- `MetricsCard` exposes a new `Actions` slot in the top bar for icon-button links alongside the title and summary.

```tsx
<MetricsLineChart
  data={points}
  series={series}
  onPointClick={point => navigate(`/traces?dateFrom=${point.from}&dateTo=${point.to}`)}
/>

<HorizontalBars data={[{ name: 'agent-a', values: [42, 3], href: '/traces?entityName=agent-a' }]} />

<MetricsDataTable columns={cols} data={rows} getRowHref={row => `/traces?threadId=${row.threadId}`} />

<MetricsCard>
  <MetricsCard.TopBar>
    <MetricsCard.TitleAndDescription title="Latency" />
    <MetricsCard.Actions>
      <IconButton href="/traces" />
    </MetricsCard.Actions>
  </MetricsCard.TopBar>
</MetricsCard>
```
