---
'@mastra/playground-ui': minor
---

Added `MetricsDashboard`, the full Metrics page body, so every app that shows Mastra metrics renders the same dashboard. Studio's Metrics page now uses it.

**What it shows:** KPIs against the previous period, token usage, agent runs, failure rate and latency over time, then trace volume and usage (cost by agent, model or thread) as ranked share lists, then each scorer's average result over time. A chart bucket or a row opens its traces. Render it inside `MetricsProvider`:

```tsx
<MetricsProvider preset={preset} filterTokens={tokens} onPresetChange={setPreset} onFilterTokensChange={setTokens}>
  <MetricsDashboard />
</MetricsProvider>
```

Each card is also exported on its own (`TokenUsageCard`, `AgentRunsCard`, `FailureRateCard`, `LatencyCard`, `TraceVolumeCard`, `UsageCard`, `ScoresCard`, `MetricsKpis`), with the pieces to build more: `ChartCard`, `ChartArea`, `KpiCard` (one headline number, with an error state), `useMetricsScores`, `useTokenSpend`, the shared number formats (`formatCount`, `formatDuration`, `formatPercent`, `formatUsd`, ...) and `CHART_COLORS`.

`MetricsLineChart` now draws a dot on each point of a series with few points, so a lone point no longer disappears.

**Breaking:** the old Metrics card views and their bar chart are removed. Use `MetricsDashboard` or its cards instead.

- Removed `HorizontalBars` (`@mastra/playground-ui/components/HorizontalBars`). Use `MetricsShareList`.
- Removed `TokenUsageByAgentCardView`, `TracesVolumeCardView`, `ModelUsageCostCardView`, `TokenUsageTimelineCardView`, `LatencyCardView`, `MemoryCardView`, `ScoresCardView`, `KpiCardView`, `BarListContent`, `StackedRunsBars` and `METRICS_DATA_LIST_PROPS`.
- `CHART_COLORS` from `@mastra/playground-ui/domains/metrics` now holds the dashboard's palette (`green`, `sky`, `violet`, `teal`, `indigo`, `warning`, `error`, `neutral`).
