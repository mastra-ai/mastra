---
'@mastra/playground-ui': minor
---

Added self-contained metrics cards and a responsive `MetricsGrid` so apps can assemble a metrics dashboard without wiring data fetching themselves.

Each card (`LatencyCard`, `MemoryCard`, `ModelUsageCostCard`, `TokenUsageByAgentCard`, `TokenUsageTimelineCard`, `TracesVolumeCard`, and the KPI cards `AgentRunsKpiCard`, `ModelCostKpiCard`, `TotalTokensKpiCard`, `ActiveThreadsKpiCard`, `ActiveResourcesKpiCard`) loads its own data from the surrounding `MetricsProvider` and keeps a stable size while loading.

Navigation is now handler-based. Cards call `onX` handlers with a drilldown scope (entity type, name, IDs, status, time window), and the app builds its own URL. When a handler is not passed, the button or clickable row is hidden.

**Breaking:** the `*CardView` metrics components, `useDrilldown`, the `href`/`LinkComponent` props on `OpenInTracesButton`/`OpenErrorsInLogsButton`, and the `tracesBasePath`/`logsBasePath` props on `MetricsProvider` were removed.

```tsx
// Before
<LatencyCardView data={data} isLoading={isLoading} isError={isError} actions={<OpenInTracesButton href={href} LinkComponent={Link} />} />

// After
<MetricsGrid>
  <LatencyCard
    onOpenTraces={scope => navigate(buildTracesDrilldownUrl({ preset, customRange, dashboardFilter, scope, tracesBasePath: "/observe/traces" }))}
  />
</MetricsGrid>
```
