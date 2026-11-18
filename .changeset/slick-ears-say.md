---
'@mastra/playground-ui': minor
---

The trace side panel and the thread side panel can now be drawn from data you load yourself, so an app with its own transport (for example an MCP server app) can compose them. Each panel has a `*View` component that never fetches: the spans, the selected span, the full trace, scorers, scores, feedback and the thread's turns come in as props, typed with the same `@mastra/client-js` response types the Studio hooks return. Actions such as starting a scorer, downloading the trace, opening the full thread and searching spans go out through callbacks.

**Added**

- `TraceSpanPanelView`, `ThreadViewByTraceView`, `TraceThreadPanelView`, `TraceScoresListView`, `TraceScoresTabView` and the `ThreadTrace.SpanDetail` part.
- `useThreadTraceSpans` (the spans of each turn of a thread) and `useTraceSearchResult` (span search for a query you control).

`TraceSpanPanel`, `TraceThreadPanel`, `ThreadViewByTrace`, `TraceScoresList` and `TraceScoresTab` keep their props and still load their data through the Mastra client.

```tsx
import { TraceSpanPanelView } from '@mastra/playground-ui/domains/traces/components/trace-span-panel-view';

<TraceSpanPanelView
  traceId={trace.traceId}
  spans={trace.spans}
  traceSpans={trace.spans} // from getTrace
  isLoadingSpans={false}
  selectedSpanId={selectedSpanId}
  selectedSpan={selectedSpan} // from getSpan
  onSpanSelect={setSelectedSpanId}
  onDownloadTrace={downloadTrace}
  onClose={closeTrace}
/>;
```

**Changed**

These components used to load part of their data themselves; pass it in now:

- `SpanDataPanelView` and `SpanDetailsView`: pass `traceSpans` so tool calls show their results, and `registeredTools` so the tools a span offered link to their pages.
- `TraceDataPanelView`: "Download trace JSON" shows only when you pass `onDownloadTrace`.
- `SpanScoring`: takes `onTriggerScorer`, which starts the scorer and resolves once it started.
- `TraceThreadItemView` and `TraceMessagesPanel`: take the trace's `spans` instead of a `traceId`.
- `ThreadTrace.Spans` takes the row's `spans`, and `ThreadTrace.SpanPanel` renders its children, typically `<ThreadTrace.SpanDetail span={selectedSpan} />`.
