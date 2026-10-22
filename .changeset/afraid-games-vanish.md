---
'@mastra/playground-ui': minor
---

Added compact options for small metrics cards in a grid:

- `MetricsLineChart`: `lineStyle="thin"` (1.5px lines, a fainter fill that fades out at both ends) and `dots="hover"` (a dot only on the hovered point).
- `MetricsShareList`: `headerPlacement="below-strip"` puts the column headers right above the rows.
- `ChartCard`: `variant="compact"` (title and total on one line, one card height with the chart filling it) and `titleMenu` to switch views from the title. Also available as `MetricsCard.TitleMenu`.

```tsx
<ChartCard
  variant="compact"
  title="Spend by model"
  titleMenu={{ value: view, onValueChange: setView, options }}
  total="$27.40"
  toolbar={<MetricsLineChartLegend series={series} />}
>
  <MetricsLineChart data={data} series={series} height="fill" showLegend={false} lineStyle="thin" dots="hover" />
</ChartCard>
```
