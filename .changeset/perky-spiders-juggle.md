---
'@mastra/playground-ui': minor
---

Added `TracesExplorer`, a compound component that renders the full traces explorer (filter bar, columns menu, auto refresh, list, and trace details panel). It is controlled: you pass the selection, filters, and sort direction as values, and `onChange` receives the next `{ selection, filters }` once per user action (a filter edit and the selection it clears arrive together). Your app decides where that state lives (URL, local state, or storage). Each part re-renders only for the state it uses, so auto-refresh and trace clicks no longer re-render the whole page.

**Removed** `useTraceUrlState` and `useTraceFilterPersistence`. URL and saved-filter handling now belongs to the host app.

**Before**

```tsx
const url = useTraceUrlState(searchParams, setSearchParams);
// ...wire url.* into FilterBar, TracesListView, TraceSpanPanel by hand
```

**After**

```tsx
import {
  DEFAULT_TRACES_FILTERS,
  EMPTY_TRACES_SELECTION,
  TracesExplorer,
} from '@mastra/playground-ui/domains/traces/components/traces-explorer';

const [state, setState] = useState({ selection: EMPTY_TRACES_SELECTION, filters: DEFAULT_TRACES_FILTERS });

<TracesExplorer
  selection={state.selection}
  filters={state.filters}
  onChange={setState}
  sortDirection={sortDirection}
  onSortDirectionChange={setSortDirection}
  metricsSupport={{ supported: true, isLoading: false }}
>
  <TracesExplorer.Layout actionRow={<TracesExplorer.FilterBar />}>
    <TracesExplorer.List />
    <TracesExplorer.Panel onOpenScore={(traceId, scoreId) => openScore(traceId, scoreId)} />
  </TracesExplorer.Layout>
</TracesExplorer>;
```

Hosts can also:

- Turn off the trace query API or feedback with `features={{ traceQuery: false, feedback: false }}`. Each switch is combined with what the server supports, so it can only turn a feature off.
- Pass `initialFilters` (for example a `last-24h` default) so the host's default filters don't count as applied.
- Compose the filter bar: `<TracesExplorer.FilterBar>` accepts children, and `TracesExplorer.FilterChips` / `TracesExplorer.TimeRangeChip` (with `presets`, `minDate`, `maxRangeMs`) can be used inside your own design-system `FilterBar`, fed by `useTracesFilterBarFields()` (the fields to offer) and `useTracesFilterBar()` (the bar value and change handlers).

```tsx
<TracesExplorer.FilterBar>
  <TracesExplorer.FilterChips timeRange={<TracesExplorer.TimeRangeChip minDate={retentionCutoff} />} />
  <FilterBar.Input placeholder="Filter traces…" />
</TracesExplorer.FilterBar>
```
