---
'@mastra/playground-ui': patch
---

Fixed span links such as `/traces/<traceId>?spanId=<spanId>`. Opening or reloading one used to drop the span: the span panel stayed closed and `spanId` disappeared from the URL. The span now opens and the timeline scrolls to it.
