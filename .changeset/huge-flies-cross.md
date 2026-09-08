---
'mastra': patch
---

Added a hover-only "Highlight spans" action under each message in the trace panel's Messages column. Clicking it fades every span in the timeline that did not contribute to that message and opens the first contributing span. The highlighted spans are stored in the URL (`highlightSpanIds`) so the view can be shared or reloaded.
