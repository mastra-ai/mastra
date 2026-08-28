---
'@mastra/playground-ui': patch
---

Load the full trace when a trace is opened in Studio. The trace list keeps using the lightweight
projection, but the trace detail panel, the logs page featured trace and the topics trace panel now
read `getTrace`, so span input, output, attributes, tags and links are available to the timeline,
the span panel and trace search instead of being silently missing.
