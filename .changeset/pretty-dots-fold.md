---
'@mastra/playground-ui': patch
'mastra': patch
---

Traces: the trace side panel now always covers the whole frame as soon as a trace is open, instead of widening step by step as the span details or messages columns are shown. The `sidePanelWidth` prop of `TracesLayout` (`@mastra/playground-ui`) was removed since the overlay has a single width.

Also removed the sliding animation of the trace panel columns: the messages column no longer pushes the span tree from left to right while the trace finishes loading.
