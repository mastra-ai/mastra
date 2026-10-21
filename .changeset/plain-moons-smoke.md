---
'@mastra/playground-ui': minor
---

Added retry and full-trace-page support to `TracesExplorer`, so hosts can recover from failed trace lists and link the trace drawer to a dedicated trace page.

- `TracesExplorer.Layout` accepts `renderError` to replace the default error state. It receives the `error`, a `refetch` function, and `isFetching`.
- `TracesExplorer.Panel` accepts `traceHref` to add an "Open trace page" link for the selected trace.
- `useTracesList()` now returns `refetch`, and the new `useTracesListFetching()` hook reports whether the list is fetching.

```tsx
<TracesExplorer.Layout
  actionRow={<TracesExplorer.FilterBar />}
  renderError={({ error, refetch, isFetching }) => (
    <MyErrorState error={error} onRetry={refetch} retrying={isFetching} />
  )}
>
  <TracesExplorer.List />
  <TracesExplorer.Panel traceHref={traceId => `/observe/traces/${traceId}`} />
</TracesExplorer.Layout>
```
