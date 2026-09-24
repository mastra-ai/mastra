---
'@mastra/playground-ui': patch
---

The logs page now opens log details in a side drawer, like the traces page. Clicking Trace or Span in a log opens the trace drawer on top. Long log messages and data no longer make the logs list scroll sideways. Removed `LogsLayout` and replaced `LogDetailsView` with `LogDataPanel`. The log drawer now has a readable timestamp heading, and the message sits in its own "Message" code section.
