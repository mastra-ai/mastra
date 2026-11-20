---
'@mastra/playground-ui': minor
---

The trace side panel and the thread side panel are now compound components. You build them from parts, give each part the data you loaded yourself, and decide what goes where. An app with its own transport (for example an MCP server app) can rebuild them, leave parts out, swap one part for its own, or add its own elements. No part fetches, except the `Live*` parts Studio composes them with (see `Added`): the spans, the open span, the full trace, scorers, scores, feedback and the thread's turns come in as props typed with the `@mastra/client-js` response types, and actions go out through callbacks.

Every part except those `Live*` ones renders with no provider at all (no Mastra client, no React Query, no Studio router), so the panels work the same inside an app that has none of them. The turn messages and a span's tool calls are drawn from what the trace recorded: a sub-agent's answer comes from its call's output, a workflow's from its input and result.

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
- `RecordedToolCard`, which draws a tool call read back from a record without any request or provider. The parts that draw tool calls (`TracePanel.Messages`, `ThreadTrace.TurnMessages`, `SpanDataPanel.Output`, `SpanDataPanelView`, `SpanDetailsView`) use it by default and take `renderToolCall` to draw richer cards, and `mcpAppTools` to tell MCP app calls apart. `useLiveToolCalls()` returns both for the chat's live cards (workflow graph, MCP app UI), as Studio uses them:

```tsx
<TracePanel.Messages spans={trace.spans} {...useLiveToolCalls()} />
```

- `navigation` on `TracePanel`, `ThreadTrace` and `SpanDataPanel` (and on `SpanDataPanelView`, `SpanDetailsView` and `TraceThreadItemView`): where the panels open things, as your callbacks. Every link of the panels (the entity, the trace page, each turn's trace, the tools a span offered, the agents and workflows it delegated to, workspaces and Knowledge pages in the turn) becomes a button that calls one of them, and text when you give none. No href, no link component, no `LinkComponentProvider`. `useStudioTraceNavigation()` builds it from Studio's router.

```tsx
<TracePanel
  traceId={trace.traceId}
  spans={trace.spans}
  onClose={close}
  navigation={{
    onOpenTrace: traceId => host.openLink(`${studioUrl}/traces/${traceId}`),
    onOpenAgent: agentId => host.openLink(`${studioUrl}/agents/${agentId}`),
  }}
>
  …
</TracePanel>
```

- `DataKeysAndValues.ValueButton`: a value drawn like `ValueLink` that acts through `onClick`.
- `SpanDataPanelView`, `TracePanel.SpanDetail` and `ThreadTrace.SpanDetail` take `input` and `output` to replace those tabs. Studio's own parts load what a view draws only once it shows: `LiveSpanInput` (the tool registry, for a span that offered tools), `LiveSpanOutput` (the trace's spans and the live tool cards, for a span that called tools), `LiveTraceMessages` and `LiveTurnMessages` (the MCP app tools, once messages show). `useLiveToolCalls({ enabled })` takes the same switch.

```tsx
<TracePanel.SpanDetail span={selectedSpan} input={<LiveSpanInput />} output={<LiveSpanOutput />} />
```

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

`MessageRow` no longer loads the MCP app tools itself: pass them in. It also takes `renderToolCard` to draw its tool calls with another card, and a read-only row no longer runs the live chat's tool call effects.

```tsx
// Before
<MessageRow message={message} />;

// After
const { data: mcpAppTools } = useMcpAppTools({ queryOptions: { enabled: messages.length > 0 } });
<MessageRow message={message} mcpAppTools={mcpAppTools} />;
```

Navigation in the panels goes through `navigation` instead of hrefs: `TracePanel.Entity`, `TracePanel.PageHeading` and `TracePanel.OpenPageButton` drop `entityHref`, `href` and `LinkComponent`, `ThreadTrace.TraceLink` drops `href`, and `TraceEntityMeta` / `TraceSummaryDescription` take `onOpenEntity` instead of `entityHref` and `LinkComponent`. Read back from a record, `WorkspaceLink` and `KnowledgePageLink` open through the record's navigation; `WorkspaceLink` takes `workspaceId` and `path` instead of an `href`.

```tsx
// Before
<TracePanel.OpenPageButton href={`/traces/${traceId}`} LinkComponent={Link} />
<ThreadTrace.TraceLink href={`/traces/${traceId}`} />

// After
<TracePanel navigation={{ onOpenTrace: traceId => navigate(`/traces/${traceId}`) }} …>
  <TracePanel.OpenPageButton />
</TracePanel>
```

In Studio, those links are now buttons that navigate through the router: they go to the same pages, but a middle-click or Cmd/Ctrl-click no longer opens them in a new tab.

Without a `LinkComponentProvider`, links now render as plain anchors instead of nothing.

**Breaking:** `ThreadTrace` places its parts through slots instead of children. `ThreadTrace.List`, `ThreadTrace.Divider`, `ThreadTrace.RowBody`, `ThreadTrace.Messages`, `ThreadTrace.TabList`, `ThreadTrace.Tab`, `ThreadTrace.TabContent`, `ThreadTrace.Details`, `ThreadTrace.DetailsHeader`, `ThreadTrace.DetailsActions` and `ThreadTrace.SpanPanel` were removed, with their prop types (`ThreadTraceListProps`, `ThreadTraceDividerProps`, `ThreadTraceRowBodyProps`, `ThreadTraceMessagesProps`, `ThreadTraceTabListProps`, `ThreadTraceTabProps`, `ThreadTraceTabContentProps`, `ThreadTraceDetailsProps`, `ThreadTraceDetailsHeaderProps`, `ThreadTraceDetailsActionsProps` and `ThreadTraceSpanPanelProps`). Render the rows as the root's children and fill each `ThreadTrace.Row` slot (`label`, `link`, `messages`, `feedback`, `scores`, `spans`, `detailsHeader`); the row draws the divider, the tabs and the details card itself.

```tsx
// Before
<ThreadTrace traceIds={ids}>
  <ThreadTrace.List>
    {ids.map((traceId, i) => (
      <ThreadTrace.Row key={traceId} traceId={traceId}>
        <ThreadTrace.Divider label={`Turn ${i + 1}`}>
          <ThreadTrace.TabList>
            <ThreadTrace.Tab value="messages">Messages</ThreadTrace.Tab>
          </ThreadTrace.TabList>
        </ThreadTrace.Divider>
        <ThreadTrace.RowBody>
          <ThreadTrace.Messages>
            <ThreadTrace.TabContent value="messages">…</ThreadTrace.TabContent>
          </ThreadTrace.Messages>
          <ThreadTrace.Details>
            <ThreadTrace.Spans />
          </ThreadTrace.Details>
        </ThreadTrace.RowBody>
      </ThreadTrace.Row>
    ))}
  </ThreadTrace.List>
  <ThreadTrace.SpanPanel />
</ThreadTrace>

// After
<ThreadTrace traceIds={ids} spanDetail={<ThreadTrace.SpanDetail span={selectedSpan} />}>
  {turns.map((turn, i) => (
    <ThreadTrace.Row
      key={turn.traceId}
      traceId={turn.traceId}
      label={`Turn ${i + 1}`}
      messages={<ThreadTrace.TurnMessages spans={turn.spans} />}
      spans={<ThreadTrace.Spans spans={turn.spans} />}
    />
  ))}
</ThreadTrace>
```

**Breaking:** `ThreadTrace.Spans` no longer loads the turn's spans: `spans` is required (and `isLoading` optional). `ThreadTrace.SpanPanel` no longer loads the open span either: pass the span you loaded to `ThreadTrace.SpanDetail` in the root's `spanDetail` slot, which shows beside the turns while a span is selected.

```tsx
// Before
<ThreadTrace.Spans />
<ThreadTrace.SpanPanel />

// After
<ThreadTrace spanDetail={<ThreadTrace.SpanDetail span={selectedSpan} />} …>
  <ThreadTrace.Row spans={<ThreadTrace.Spans spans={turn.spans} isLoading={turn.isLoading} />} … />
</ThreadTrace>
```

`useTraceSearch` returns `payloadOnlyMatchIds` as a `ReadonlySet<string>` instead of a `Set<string>`: read it, copy it to change it.

These components used to load part of their data themselves; pass it in now:

- `SpanDataPanelView` and `SpanDetailsView`: pass `traceSpans` so tool calls show their results, and `registeredTools` so the tools a span offered open through `navigation.onOpenTool`.
- `SpanScoring`: takes `onTriggerScorer`, which starts the scorer and resolves once it started.
- `TraceThreadItemView`: takes the trace's `spans` instead of a `traceId`.

**Removed**

- `TraceDataPanelView`: compose `TracePanel` instead (it renders the same panel part by part).
- `TraceMessagesPanel`: use `TracePanel.Messages`.
- `TraceDataPanel`: compose `TracePanel.ScoreButton` in the header with `TracePanel.ScoreDialog` in the frame's `dialogs` slot.
