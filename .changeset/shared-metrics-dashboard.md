---
'@mastra/playground-ui': minor
---

Added self-contained Metrics cards and a responsive `MetricsGrid`, so every app that shows Mastra metrics can assemble the same dashboard. Studio's Metrics page now uses them.

**What they show:** KPIs against the previous period (`MetricsKpis`), token usage, agent runs, failure rate and latency over time, trace volume and usage (cost by agent, model or thread) as ranked share lists, and each scorer's average result over time. Each card loads its own data from the surrounding `MetricsProvider`.

**Navigation is up to the app.** Cards call plain callbacks with what was clicked, and the app builds its own URL (for example with `buildTracesDrilldownUrl`). Without a callback, the button or clickable row is hidden.

```tsx
<MetricsProvider preset={preset} filterTokens={tokens} onPresetChange={setPreset} onFilterTokensChange={setTokens}>
  <MetricsKpis />
  <MetricsGrid columns={3}>
    <LatencyCard
      onViewTraces={entityType => navigate(`/traces?rootEntityType=${entityType}`)}
      onTimeRangeClick={({ from, to }) => openTracesBetween(from, to)}
    />
    <UsageCard onAgentClick={name => openAgentTraces(name)} onModelClick={openModelTraces} />
  </MetricsGrid>
</MetricsProvider>
```

Cards: `TokenUsageCard`, `AgentRunsCard`, `FailureRateCard`, `LatencyCard`, `TraceVolumeCard`, `UsageCard`, `ScoresCard`, `MetricsKpis`. Building blocks: `ChartCard`, `ChartArea`, `KpiCard`, `MetricsGrid`, `useMetricsScores`, `useTokenSpend`, the shared number formats (`formatCount`, `formatDuration`, `formatPercent`, `formatUsd`, ...) and `CHART_COLORS`.

`MetricsLineChart` now draws a dot on each point of a series with few points, so a lone point no longer disappears.

**Breaking:** the old Metrics card views and their bar chart are removed. Use the new cards instead.

- `OpenInTracesButton` and `OpenErrorsInLogsButton` take an `onClick` instead of `href`/`LinkComponent`. `useDrilldown` and the `tracesBasePath`/`logsBasePath` options on `MetricsProvider` are removed.
- Removed `HorizontalBars` (`@mastra/playground-ui/components/HorizontalBars`). Use `MetricsShareList`.
- Removed `TokenUsageByAgentCardView`, `TracesVolumeCardView`, `ModelUsageCostCardView`, `TokenUsageTimelineCardView`, `LatencyCardView`, `MemoryCardView`, `ScoresCardView`, `KpiCardView`, `BarListContent`, `StackedRunsBars` and `METRICS_DATA_LIST_PROPS`.
- `CHART_COLORS` from `@mastra/playground-ui/domains/metrics` now holds the dashboard's palette (`green`, `sky`, `violet`, `teal`, `indigo`, `warning`, `error`, `neutral`).
