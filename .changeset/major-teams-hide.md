---
'@mastra/playground-ui': minor
---

Added the trace detail panels to `@mastra/playground-ui` so you can build your own traces page. `TraceSpanPanel`, `TraceThreadPanel`, `ThreadViewByTrace`, the feedback tabs, the feedback hooks (including `useUpdateFeedbackReviewStatus`), `ReviewStatusBadge` and the dataset dialogs are now exported from `@mastra/playground-ui/domains/*`. They no longer depend on a router: pass `anchorTraceId` and an `onOpenScore(traceId, scoreId)` callback to handle navigation in your app.
