---
'@mastra/playground-ui': minor
---

The trace side panel and the thread side panel are now compound components that you compose part by part, giving each part the data you loaded yourself. An app with its own transport (for example an MCP server app) can rebuild them, leave parts out, reorder them, or add its own parts. No part fetches: the spans, the open span, the full trace, scorers, scores, feedback and the thread's turns come in as props typed with the `@mastra/client-js` response types, and actions go out through callbacks.

```tsx
import { TracePanel } from '@mastra/playground-ui/domains/traces/components/trace-panel';

<TracePanel traceId={trace.traceId} spans={trace.spans} selectedSpanId={spanId} onSpanSelect={setSpanId} onClose={close}>
  <TracePanel.Frame variant="inline">
    <TracePanel.Header>
      <TracePanel.TraceId />
      <TracePanel.Actions>
        <TracePanel.DownloadButton onDownload={downloadTrace} />
      </TracePanel.Actions>
    </TracePanel.Header>
    <TracePanel.Body>
      <TracePanel.Main>
        <TracePanel.Spans traceSpans={trace.spans} />
      </TracePanel.Main>
      <TracePanel.SpanPanel>
        <TracePanel.SpanDetail span={selectedSpan} traceSpans={trace.spans} />
      </TracePanel.SpanPanel>
    </TracePanel.Body>
  </TracePanel.Frame>
</TracePanel>;
```

**Added**

- `TracePanel`, a state-only root with parts for the frame (drawer or inline), the header and its actions (navigation, trace id, score, download, dataset, open page, close), the summary, the side column (Messages, Feedback, Scores or your own views, plus "Open full thread"), the span search and tree, and the open span.
- `ThreadTrace` parts to compose a turn: `TurnMessages`, `TraceLink`, `MessagesTab`, `FeedbackTab`, `ScoresTab` and `SpanDetail`, plus `Loading`, `Empty` and `Error` for the thread's states. The root accepts a controlled `selectedSpan`.
- `TraceThreadPanelView`, `TraceScoresListView` and `TraceScoresTabView`, and `FeedbackThread` is exported with its props.
- `useThreadTraceSpans` and `useTraceSearchResult` data hooks.

`TraceThreadPanel`, `ThreadViewByTrace`, `TraceScoresList`, `TraceScoresTab` and `TraceDataPanelView` keep their props.

**Changed**

`TraceSpanPanel` no longer renders the full-thread drawer. It hands the thread id to `onOpenFullThread`, and you render the thread wherever you want, or not at all. `isFullThreadOpen`, `onFullThreadOpenChange`, `withQueryTrace`, `withFeedback`, `feedbackOptions` and `onOpenScore` are gone from its props.

```tsx
// Before
<TraceSpanPanel {...panelProps} isFullThreadOpen={open} onFullThreadOpenChange={setOpen} withQueryTrace withFeedback onOpenScore={openScore} />

// After
<TraceSpanPanel {...panelProps} onOpenFullThread={setThreadId} />
<TraceThreadPanel open={!!threadId} threadId={threadId ?? ''} onClose={() => setThreadId(undefined)} withQueryTrace withFeedback onOpenScore={openScore} />
```

These components used to load part of their data themselves; pass it in now:

- `SpanDataPanelView` and `SpanDetailsView`: pass `traceSpans` so tool calls show their results, and `registeredTools` so the tools a span offered link to their pages.
- `TraceDataPanelView`: "Download trace JSON" shows only when you pass `onDownloadTrace`.
- `SpanScoring`: takes `onTriggerScorer`, which starts the scorer and resolves once it started.
- `TraceThreadItemView` and `TraceMessagesPanel`: take the trace's `spans` instead of a `traceId`.
- `ThreadTrace.Spans` takes the row's `spans`, and `ThreadTrace.SpanPanel` renders its children, typically `<ThreadTrace.SpanDetail span={selectedSpan} />`.

**Removed**

- `TraceDataPanel`: compose `TracePanel.ScoreButton` with `TracePanel.ScoreDialog` instead.
