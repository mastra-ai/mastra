---
'@mastra/playground-ui': minor
---

The trace side panel and the thread side panel are now compound components. You build them from parts, give each part the data you loaded yourself, and decide what goes where. An app with its own transport (for example an MCP server app) can rebuild them, leave parts out, swap one part for its own, or add its own elements. No part fetches: the spans, the open span, the full trace, scorers, scores, feedback and the thread's turns come in as props typed with the `@mastra/client-js` response types, and actions go out through callbacks.

Layout parts take named slots (`header`, `body`, `side`, `main`, `span`, `messages`, `feedback`…), so a slot you leave empty renders nothing, and an element you pass renders exactly there.

```tsx
import { TracePanel } from '@mastra/playground-ui/domains/traces/components/trace-panel';

<TracePanel
  traceId={trace.traceId}
  spans={trace.spans}
  selectedSpanId={spanId}
  onSpanSelect={setSpanId}
  onClose={close}
>
  <TracePanel.Frame
    variant="inline"
    header={
      <TracePanel.Header
        title={<TracePanel.TraceId />}
        actions={<TracePanel.DownloadButton onDownload={downloadTrace} />}
      />
    }
    body={
      <TracePanel.Body
        side={<TracePanel.Side feedback={<MyFeedback traceId={trace.traceId} />} />}
        main={<TracePanel.Main spans={<TracePanel.Spans traceSpans={trace.spans} />} />}
        span={<TracePanel.SpanDetail span={selectedSpan} traceSpans={trace.spans} />}
      />
    }
  />
</TracePanel>;
```

```tsx
import { ThreadTrace } from '@mastra/playground-ui/domains/traces/components/thread-trace';

<ThreadTrace traceIds={ids} spanDetail={<ThreadTrace.SpanDetail span={selectedSpan} />}>
  {turns.map((turn, index) => (
    <ThreadTrace.Row
      key={turn.traceId}
      traceId={turn.traceId}
      label={`Turn ${index + 1}`}
      messages={<ThreadTrace.TurnMessages spans={turn.spans} />}
      scores={<MyScores traceId={turn.traceId} />}
      spans={<ThreadTrace.Spans spans={turn.spans} />}
    />
  ))}
</ThreadTrace>;
```

**Added**

- `TracePanel`, a state-only root. `TracePanel.Frame` (drawer or inline) takes `banner`, `header`, `summary`, `body` and `dialogs`. `TracePanel.Header` takes `navigation`, `title` and `actions`; `TracePanel.Summary` takes `entity`, `status` and `stats`; `TracePanel.Body` takes `side`, `main` and `span`; `TracePanel.Side` takes `messages`, `feedback`, `scores` (one tab per filled view) and `actions`; `TracePanel.Main` takes `toolbar`, `notices` and `spans`. Leaf parts cover the navigation, trace id, score, download, dataset, open page and close buttons, the search, the tree/timeline switch, the spans (with `leading` and `renderRowTrailing` for your own cells) and the open span.
- `SpanDataPanel`, the span detail as parts: `header`, `details`, `input`, `output` and `feedback` slots on the root, with `Header`, `Identity`, `ShowTraceButton`, `Navigation`, `CloseButton`, `Details`, `Input` and `Output` parts. A tab slot you leave empty drops that tab. `SpanDataPanelView` stays as the ready-made composition with every tab.
- `ThreadTrace`: the root takes a `spanDetail` slot and a controlled `selectedSpan`; `ThreadTrace.Row` takes `label`, `link`, `messages`, `feedback`, `scores`, `spans` and `detailsHeader`, plus a controlled `tab`. Parts: `TurnMessages`, `TraceLink`, `Spans`, `SpanDetail`, `Loading`, `Empty` and `Error`.
- `TraceThreadPanelView`, `TraceScoresListView` and `TraceScoresTabView`, and `FeedbackThread` is exported with its props.
- `useThreadTraceSpans` and `useTraceSearchResult` data hooks.

`TraceThreadPanel`, `ThreadViewByTrace`, `TraceScoresList` and `TraceScoresTab` keep their props.

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
- `SpanScoring`: takes `onTriggerScorer`, which starts the scorer and resolves once it started.
- `TraceThreadItemView`: takes the trace's `spans` instead of a `traceId`.

**Removed**

- `TraceDataPanelView`: compose `TracePanel` instead (it renders the same panel part by part).
- `TraceMessagesPanel`: use `TracePanel.Messages`.
- `TraceDataPanel`: compose `TracePanel.ScoreButton` in the header with `TracePanel.ScoreDialog` in the frame's `dialogs` slot.
