---
'@mastra/playground-ui': patch
'mastra': patch
---

Added a hover-only "Highlight spans" action under each message in the trace panel's Messages tab. Clicking it switches back to the Spans tab, fades every span that did not contribute to that message, and opens the first contributing span. The highlighted spans are stored in the URL (`highlightSpanIds`) so the view can be shared or reloaded.
