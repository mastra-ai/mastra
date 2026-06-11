---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/observability': patch
'@mastra/server': patch
'@mastra/core': patch
---

Added an optional noticeSlot to TraceDataPanelView so consumers can render contextual notices above the trace timeline (used by Studio to explain tool-replay runs)
