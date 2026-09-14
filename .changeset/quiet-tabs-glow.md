---
'@mastra/playground-ui': patch
---

**`TraceDataPanelView`**: the trace panel is now always tabbed (Spans · Timeline · Feedback · Scores), with a new "Timeline" tab that keeps the span tree (names, expansion controls) and adds a trailing column of bars on a shared time axis (`TraceSpanTimeline`). Both tabs share the same search, selection and expansion state. The tab header is more compact and the span type legend is left-aligned.

The `messagesPanelSlot` column still renders to the left of the span tree, and now folds away while the Timeline tab is active so the bars get the width.

`TraceDataPanelTab` gains the `'timeline'` value.
