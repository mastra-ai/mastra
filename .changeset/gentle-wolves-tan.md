---
'@mastra/playground-ui': patch
---

Marked synthetic tool spans in the span detail panels: when a trace span was served from a tool-replay recording or a tool mock instead of executing, the span detail view now shows a 'Synthetic replay span' notice with the outcome and the recording-tape position, so a served recording is never mistaken for a live tool execution.
