---
'@internal/playground': patch
---

Refactored the span Scores list (Observability → Trace → Span → Scores tab) to use the condensed `DataList` primitives, matching the visual style of the Traces, Logs, and Dataset Items lists. Removed the dead local `ScoreDialog` and the `initialScoreId` prop chain (`TraceDialog → SpanDialog → SpanTabs → SpanScoreList`) — the score detail is rendered by the page-level `ScoreDataPanel` driven by the `?scoreId=` URL parameter.
