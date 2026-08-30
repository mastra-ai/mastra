---
'@mastra/observability': patch
---

Don't let a span's `undefined` explicit metadata shadow a `requestContextKeys` value. An agent-run span names `threadId` (`threadFromArgs?.id`), which is `undefined` when no memory is configured; that own property used to win the merge and drop the value extracted from the RequestContext. A key the span actually provides still takes precedence.
