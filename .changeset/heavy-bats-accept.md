---
'@mastra/playground-ui': minor
---

Replaced the trace panel's "Messages" tab with a "Messages" column so an agent turn reads left-to-right as Messages → Trace → Span detail.

**`TraceDataPanelView`**: the `partialThreadTabSlot` prop was removed. Pass `messagesPanelSlot` instead; it renders as a column to the left of the timeline inside the same card, and the columns animate open/closed.

```tsx
// Before
<TraceDataPanelView partialThreadTabSlot={({ traceId }) => <ThreadView traceId={traceId} />} />

// After
<TraceDataPanelView messagesPanelSlot={<ThreadView traceId={traceId} />} />
```

**`TracesLayout`**: `sidePanelWide` (boolean) was replaced by `sidePanelWidth: 'half' | 'wide' | 'full'`. `'full'` lets a three-column panel span the whole frame.

```tsx
// Before
<TracesLayout sidePanelWide={!!spanId} />

// After
<TracesLayout sidePanelWidth={spanId ? 'wide' : 'half'} />
```
