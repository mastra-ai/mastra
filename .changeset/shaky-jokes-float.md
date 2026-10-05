---
'@mastra/playground-ui': minor
---

Metrics KPI cards now show the change badge next to the card title, and hovering or focusing it names the window it compares against, such as "vs previous 7d (693)". The window follows the selected time range, including custom ranges, instead of the generic "vs prior period".

`MetricsKpiCard.Change` now takes a `comparison` prop for the tooltip text, and the new `MetricsKpiCard.Header` places it beside the label.

```tsx
<MetricsKpiCard.Header>
  <MetricsKpiCard.Label>Agent runs</MetricsKpiCard.Label>
  <MetricsKpiCard.Change changePct={2.6} comparison="vs previous 7d" prevValue="692" />
</MetricsKpiCard.Header>
```
