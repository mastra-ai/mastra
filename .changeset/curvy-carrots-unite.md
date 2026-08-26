---
'@mastra/playground-ui': patch
'mastra': patch
---

Improved the Traces page: trace actions (Evaluate Trace, Save as Dataset Item, Add tool mocks) now live in the trace panel header next to the collapse button, removed the empty gap above the traces list when no filters are applied, and replaced the auto-refetch icon button with a labeled "Auto refresh" checkbox (the subtraces toggle is now a "Subtraces" checkbox too). The trace panel now has Details and Scores tabs — Evaluate Trace switches to the Scores tab showing the trace's scores — and the span panel's Scoring tab was removed. The evaluate action is now labeled "Score trace", and the no-traces empty state no longer shows a documentation CTA. The standalone `/traces/:traceId` page was removed — those URLs now redirect to `/traces?traceId=...`, and all in-app links point to the query-param form.
