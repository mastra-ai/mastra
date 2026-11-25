---
'@mastra/playground-ui': patch
---

Improved bar charts: a time bucket that counted zero now shows a short neutral stub instead of a blank space, so a quiet stretch reads as "nothing happened" and not as missing data. Buckets without data (left out or `null`) and buckets that have not started yet stay empty.

Applies to every `MetricsStackedBarChart`, including the Metrics cards, dashboards and the Traces and Spans histograms.

```tsx
<MetricsStackedBarChart
  series={[{ dataKey: 'runs', label: 'Runs', color: 'var(--chart-green)' }]}
  data={[
    { time: 'Oct 1', runs: 7 },
    { time: 'Oct 2', runs: 0 }, // counted zero: a stub
    { time: 'Oct 3' }, // no data: stays empty
  ]}
/>
```
