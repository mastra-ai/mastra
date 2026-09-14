---
'@mastra/playground-ui': patch
---

Split the trace timeline into two composable views. `TraceSpanTree` renders the span hierarchy with each span's duration at the end of the row, and `TraceSpanTimeline` renders spans as bars on a shared time axis. Both share the same expansion, selection and reveal behavior through the headless `SpanRows` walker, so they stay aligned when shown together. `TraceTimeline` and `TraceTimelineSpan` are deprecated and now wrap `TraceSpanTree`; the trace panel, trace details and thread trace views now show the tree with the duration as text.
