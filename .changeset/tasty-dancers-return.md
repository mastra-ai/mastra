---
'@mastra/playground-ui': patch
---

Re-exported `useSpanQueryAvailable` from `@mastra/playground-ui/domains/capabilities`, and added a spans filter bar (`@mastra/playground-ui/domains/spans`) that offers only the fields the span query accepts.

`SpanDataPanelView` takes an optional `onShowTrace` callback. When it is set, the panel header shows a "Go to trace" button that calls it with the span's `traceId` and `spanId`, so your app decides where the trace opens.

```tsx
<SpanDataPanelView
  traceId={traceId}
  spanId={spanId}
  span={span}
  onShowTrace={({ traceId, spanId }) => navigate(`/traces?traceId=${traceId}&spanId=${spanId}`)}
/>
```

`TracesExplorer.Layout` takes two new optional slots. `tabs` is pinned under the header and stays visible while filter fields load. `toolbar` renders at the top of the page body, above the list, and stays up when the list fails so filters can still be changed. `actionRow` is now optional.

```tsx
<TracesExplorer.Layout
  breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
  tabs={<ViewTabs />}
  toolbar={<TracesExplorer.FilterBar />}
>
  <TracesExplorer.List />
</TracesExplorer.Layout>
```

`FilterBar` chips that are already there when the bar mounts no longer play their entrance animation; only chips added afterwards animate in. The traces loading skeleton now matches the toolbar's pill-shaped controls and spacing, so the page no longer jumps when it finishes loading.

`NoTracesInfo` and `TracesListView` take an optional `resource` prop (`'traces'` by default). Pass `'spans'` to show span lists' empty messages with "spans" instead of "traces", for example "No spans for the last 7 days".

`TracesExplorer`'s `features` prop takes a `spanQuery` switch, next to `traceQuery` and `feedback`. Unlike them, it is opt-in: span queries are on only when the host sets `spanQuery: true` and the server supports them. Read the result from `useTracesConfig().withSpanQuery`, for example to decide whether to show a link to a spans view.

```tsx
<TracesExplorer features={{ spanQuery: flags.spans }} {...props}>
  <TracesPageContent />
</TracesExplorer>
```
