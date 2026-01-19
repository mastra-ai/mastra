---
'@mastra/playground-ui': patch
'create-mastra': patch
'mastra': patch
---

fix isTopLevelSpan value definition on SpanScoring to properly recognize lack of span?.parentSpanId value (null or empty string)
