---
'@mastra/playground-ui': patch
---

Fixed deep links to a nested span, such as `/traces/<traceId>?spanId=<spanId>`. The timeline scrolled to the span only when it sat at the top level; nested spans render one commit later, once their parents expand, so the scroll ran against an element that did not exist yet and never retried. The timeline now scrolls to the span whatever its depth.
