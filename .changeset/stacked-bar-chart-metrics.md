---
'@mastra/playground-ui': minor
---

Added `MetricsStackedBarChart` for per-day totals split by series, such as usage by resource. It shares the series, legend, and tooltip of `MetricsLineChart`. A `valueFormatter` prop formats the y-axis and tooltip values, `referenceLine` draws a dashed line at a threshold such as an included quota, and `MetricsLineChartTooltip` now accepts a `formatValue` prop.

```tsx
import { MetricsStackedBarChart } from '@mastra/playground-ui/components/MetricsStackedBarChart';

<MetricsStackedBarChart
  data={data}
  series={series}
  valueFormatter={formatUsd}
  referenceLine={{ value: 100, label: '100 GB included', color: 'var(--destructive-indicator)' }}
/>;
```
