---
'@mastra/playground-ui': patch
---

Opening the full thread from a trace now shows the thread in its own drawer stacked above the trace, instead of replacing it. The trace stays visible underneath, and "Back to trace" or Escape closes only the thread drawer. `TraceThreadPanel` now takes `open` and an optional `depth` prop, and `onBack` was removed in favor of `onClose`.

The "Open full thread" button now sits in the trace side column's tab row, next to Messages, Feedback and Scores, instead of above the conversation.

When the trace side column is 500px wide or less, the Messages, Feedback and Scores tabs and the "Open full thread" button collapse to icons, with tooltips on hover and keyboard focus. `Tab` now accepts an optional `tooltip` prop.
