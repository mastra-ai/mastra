---
'@mastra/playground-ui': minor
---

Added a reusable `MetricsBarChart` for responsive metric dashboards with themed bars, axes, formatted tooltips, and accessible descriptions.

```tsx
<MetricsBarChart
  data={points}
  series={[{ dataKey: 'done', label: 'Completed work', color: 'var(--chart-2)' }]}
  description="Daily completed work."
/>
```
