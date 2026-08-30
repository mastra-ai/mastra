---
'@mastra/observability': patch
---

Fixed span metadata precedence so `RequestContext` values are preserved when explicit metadata is `undefined`. Defined explicit metadata still takes precedence.
