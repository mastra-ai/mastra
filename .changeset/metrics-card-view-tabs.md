---
'@mastra/playground-ui': minor
---

Metrics cards with several views show them as tabs under the card title again, instead of a dropdown in the title. Every view is one click away, with the same ghost pill tabs as the Studio's other view switches; on a card too narrow for them all, the tabs scroll sideways. This covers the hand-built cards (`TokenUsageCard`, `AgentRunsCard`, `LatencyCard`, `TraceVolumeCard`, `UsageCard`, `BreakdownCard`) and every widget rendered by `DashboardRenderer` or `StatelessWidget`, which look the same. The card title now names the whole card ("Latency", with "Agent latency", "Workflow latency" and "Tool latency" tabs), and a dashboard widget's title stays editable with `onTitleChange` when it has several views.

Switching views keeps the card in place on every card: the tab picked keeps the focus, the pill slides to it, and on a narrow card the tab row stays scrolled to it. `AgentRunsCard` and `UsageCard` no longer reload a view's data when you switch back to it.

**Breaking:** `ChartCard`'s `titleMenu` prop is replaced by `tabs`, which takes the same `value`, `onValueChange` and `options`. Pass the card's own title as `title`. `FailureRateCard` no longer takes `titleMenu`. `ChartCardTabs` is exported for cards built by hand, and `ChartArea` takes `isUpdating` to dim a body that loads apart from its card.

```tsx
// Before
<ChartCard
  title="Agent latency"
  titleMenu={{ value: view, onValueChange: setView, options: [{ value: 'agents', label: 'Agent latency' }, …] }}
/>

// After
<ChartCard
  title="Latency"
  tabs={{ value: view, onValueChange: setView, options: [{ value: 'agents', label: 'Agent latency' }, …] }}
/>
```
