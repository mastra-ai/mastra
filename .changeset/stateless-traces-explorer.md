---
'@mastra/playground-ui': minor
---

The whole traces page, filters and histogram included, now renders from data you hand it. `TracesExplorer` and every part under it (`FilterBar`, `ColumnsMenu`, `Histogram`, `List`, `Body`, `Layout`, `Panel`) no longer fetch: they take records typed with the `@mastra/client-js` response types and report every action through a callback. An app with its own transport, for example an MCP server app, can now show the same page from its own queries, with no Mastra client, no React Query and no Studio router.

Studio loads the same records through new data hooks, exported separately, so it shows the same page as before.

```tsx
import { TracesExplorer } from '@mastra/playground-ui/domains/traces/components/traces-explorer';

<TracesExplorer
  selection={selection}
  filters={filters}
  onChange={setState}
  sort={sort}
  onSortChange={setSort}
  columns={columns}
  onColumnsChange={setColumns}
  capabilities={{ data: capabilitiesResponse, isLoading: false }}
  traces={{ rows, isLoading, isFetching, isFetchingNextPage, hasNextPage, onLoadMore, onRetry }}
  discovery={{ fields, canonicalFields, isLoading: false }}
  metricsSupport={{ supported: true, isLoading: false }}
>
  <TracesExplorer.Body
    toolbar={<TracesExplorer.FilterBar suggestions={{ rootEntityNames, environments }} />}
    chart={<TracesExplorer.Histogram data={{ timeRange, rows: counts, isLoading, isError, isUpdating }} />}
  >
    <TracesExplorer.List usage={usageByTraceId} />
    <TracesExplorer.Panel
      trace={openTrace}
      navigation={{ onOpenAgent, onOpenTrace }}
      onDownload={downloadTrace}
      renderThread={({ open, threadId, onClose }) => <MyThread open={open} threadId={threadId} onClose={onClose} />}
    />
  </TracesExplorer.Body>
</TracesExplorer>;
```

**Added**

- Data contract types for the page: `TracesExplorerCapabilities`, `TracesExplorerTraces`, `TracesExplorerDiscovery`, `TracesExplorerFilterSuggestions`, `TracesExplorerHistogram`, `TracesExplorerUsage` and `TracesExplorerOpenTrace`.
- Studio data hooks that load those records through the Mastra client: `useTracesListQuery`, `useTracesDiscoveryQuery`, `useTracesFilterSuggestionsQuery`, `useTracesHistogramQuery`, `useTracesUsageQuery` and `useOpenTraceQuery`, exported from `domains/traces/hooks`.
- Helpers that build the same queries for any host: `buildTracesListQuery`, `buildTracesHistogramRequest`, `canShowTracesHistogram`, `resolveTracesSupport`, `resolveTracesSort` and `resolveTraceUsageColumns`.
- `TraceSpanPanelView`, the trace drawer drawn from the records you pass, with no fetching. `TraceSpanPanel` keeps loading them through the Mastra client.
- `ScoreDataPanelView`, the score drawer drawn from the score you pass: its trace and span open through `onOpenTrace`, and its dataset dialog is yours (`renderDatasetDialog`). `TracesExplorer.Panel` takes them as `onOpenScoreTrace` and `renderScoreDatasetDialog`. `ScoreDataPanel` keeps Studio's router and dataset dialog; its trace and span ids are now buttons that go to the same pages, so they no longer open in a new tab on middle-click.

**Breaking**

- `TracesExplorer` now requires `capabilities`, `traces`, `columns` and `onColumnsChange`, and takes `discovery`. It no longer reads the store's capabilities, lists traces, discovers fields or stores the column selection itself.
- `TracesExplorer.FilterBar` takes its suggestions as `suggestions`, `TracesExplorer.Histogram` its counts as `data`, and `TracesExplorer.List` its usage as `usage`. `useTracesFilterBarFields()` takes the suggestions as its argument.
- `TracesExplorer.Panel` takes the open trace as `trace` and its links as `navigation` callbacks. Its views that load their own data come in through `renderMessages`, `spanInput`, `spanOutput`, `renderFeedback`, `renderSpanFeedback`, `renderScores`, `renderThread` and `renderDatasetDialog`. `traceHref` is replaced by `navigation.onOpenTrace`, `withAddTraceToDataset` by `renderDatasetDialog`, and `onOpenScore` and `renderCreateDatasetDialog` move into your `renderThread` and `renderDatasetDialog`. The root's `feedbackOptions` reach your `renderFeedback`, `renderSpanFeedback` and `renderThread` in their arguments.
- `TracesExplorerErrorRenderArgs['refetch']` now calls your `traces.onRetry`.
- `useTracesDiscovery` is removed: use `useTracesDiscoveryQuery` and pass its result as `discovery`.
- `useTracesConfig()` no longer returns `withDeltaPolling`: no part reads it, since only the list query polls. Read it from `resolveTracesSupport(capabilities, features)`.
- `ObservabilityPageLayout` takes the views to offer as `views` instead of `features`. Pass the result of `useObservabilityViews({ current, features })`.

```tsx
// Before
<TracesExplorer
  metricsSupport={metrics}
  selection={selection}
  filters={filters}
  onChange={setState}
  sort={sort}
  onSortChange={setSort}
>
  <TracesExplorer.Body toolbar={<TracesExplorer.FilterBar />} chart={<TracesExplorer.Histogram />}>
    <TracesExplorer.List />
    <TracesExplorer.Panel onOpenScore={openScore} traceHref={traceId => `/traces/${traceId}`} />
  </TracesExplorer.Body>
</TracesExplorer>;

// After (Studio)
const capabilities = useObservabilityCapabilities();
const columns = useTraceColumnPreferences();
const traces = useTracesListQuery({ filters, sort, columns: columns.preferences, capabilities });
const discovery = useTracesDiscoveryQuery({ filters, capabilities });

<TracesExplorer
  metricsSupport={metrics}
  selection={selection}
  filters={filters}
  onChange={setState}
  sort={sort}
  onSortChange={setSort}
  columns={columns.preferences}
  onColumnsChange={columns.setPreferences}
  capabilities={capabilities}
  traces={traces}
  discovery={discovery}
>
  <TracesExplorer.Body toolbar={<MyFilterBar />} chart={<MyHistogram />}>
    <MyList />
    <MyPanel />
  </TracesExplorer.Body>
</TracesExplorer>;
```

Each `My*` part calls its data hook (`useTracesFilterSuggestionsQuery`, `useTracesHistogramQuery`, `useTracesUsageQuery`, `useOpenTraceQuery`) and passes the result to its explorer part. Rendered inside the body, a part loads its records only once the body shows it, as before.
