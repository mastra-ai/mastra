---
'@internal/playground': patch
---

Refactored the span Feedback list (Observability → Trace → Span → Feedback tab) to use the condensed `DataList` primitives, matching the visual style of the Traces, Logs, Scores, and Dataset Items lists. The Feedback detail dialog is unchanged — only the list rendering moved off `EntryList`.
