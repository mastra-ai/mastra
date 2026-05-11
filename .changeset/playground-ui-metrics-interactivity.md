---
'@mastra/playground-ui': minor
---

Added opt-in interactivity and per-page filter persistence support for observability UI components.

- `MetricsLineChart` accepts an `onPointClick` callback so chart points can drive drilldowns.
- `HorizontalBars` accepts row-level and segment-level hrefs for linked metric bars without nested anchors.
- `MetricsDataTable` accepts `getRowHref(row)` for linked rows with consistent hover and focus styling.
- `MetricsCard` exposes an `Actions` slot in the top bar for contextual icon links.
- Observability filter helpers for Metrics, Traces, and Logs each keep their own saved-filters storage key so pages remember filters independently.

All additions are optional, so existing consumers continue to render the same way unless they pass the new props.

```tsx
<MetricsLineChart
  data={points}
  series={series}
  onPointClick={point => navigate(`/observability?dateFrom=${point.from}&dateTo=${point.to}`)}
/>

<HorizontalBars data={[{ name: 'agent-a', values: [42, 3], href: '/observability?filterEntityName=agent-a' }]} />

<MetricsDataTable columns={cols} data={rows} getRowHref={row => `/observability?filterThreadId=${row.threadId}`} />

<MetricsCard>
  <MetricsCard.TopBar>
    <MetricsCard.TitleAndDescription title="Latency" />
    <MetricsCard.Actions>
      <IconButton href="/observability" />
    </MetricsCard.Actions>
  </MetricsCard.TopBar>
</MetricsCard>
```
