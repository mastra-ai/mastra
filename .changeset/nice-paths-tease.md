---
'@mastra/playground-ui': minor
---

Added a Threads view to the traces explorer. It lists conversation threads with the same filters, time range, sorting and infinite scroll as the spans view, and opens the full thread in a drawer. The Threads tab is off by default. Hosts turn it on with `features.threadQuery`, and it only shows when the observability store can return thread rows.

```tsx
<TracesExplorer features={{ spanQuery: true, threadQuery: true }}>…</TracesExplorer>
```

`TraceThreadPanel` also accepts a `closeLabel` prop to rename its close button.
