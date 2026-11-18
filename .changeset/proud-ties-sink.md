---
'@mastra/playground-ui': minor
---

Added a way to cap how many days a word search covers in the traces and spans explorers. Hosts whose trace store limits word search (the hosted trace query API allows 7 days) can now pass `searchMaxDays`:

```tsx
<TracesExplorer {...props} searchMaxDays={7}>
  <TracesExplorer.FilterBar />
  <TracesExplorer.SearchNote />
</TracesExplorer>

<SpansExplorerBody {...props} searchMaxDays={7} />
```

While a word search is active, the time range picker only offers ranges up to that many days and explains why the longer ones are off. Adding a word to a longer range narrows it to the last 7 days (a custom range keeps its end) and a note under the filter bar says so. `DateTimeRangePicker` gains a `rangeLimit` prop for the same behavior elsewhere, and `useObservabilityListFilters` returns `searchRangeLimit`, `searchNarrowed` and `narrowRangeForSearch` for hosts that render their own spans filter bar.
