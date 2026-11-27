---
'@mastra/playground-ui': minor
---

Removed trace components that Studio and Platform no longer render, and the unused `ee/topics` entry.

**Removed**

- `TraceTimeline`, `TraceTimelineSpan`, `TimelineStructureSign` and `TimelineTimingCol`: use `TraceSpanTimeline` and `TraceSpanTree`, or compose `TracePanel`.
- `SpanDetailsView`, `TraceDetailsView`, `TraceIdButton`, `SpanSummaryDescription` and `SpanRunId`: use `SpanDataPanelView` and `TracePanel`.
- `SpanPayloadSection`, `SpanPayloadJsonSection`, `SpanErrorRenderer`, `SpanProcessorAttributes`, `SpanProcessorMutations`, `SpanToolsSection`, `SpanToolCallsSection` and `SpanAvailableToolsSection`: `SpanDataPanelView` draws these. `SpanErrorDetails`, `SpanToolList` and `SpanToolCallList` stay.
- `TracesListModeToggle`: use `TracesSpansSwitch`.
- `@mastra/playground-ui/ee/topics`: `TopicsLayout`, `TopicTraceDetailsPanel`, `TopicTraceSummaryList`, and their types and helpers.
