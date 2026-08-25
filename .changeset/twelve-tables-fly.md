---
'@mastra/observability': patch
---

Added `span.endTree()` for closing a span together with every descendant span that is still open, so an operation that is abandoned rather than completed can still emit a full trace. The options you pass are applied to every span it closes, so a force-closed child is distinguishable from one that finished on its own.

```ts
// Ends the span and any child spans still open beneath it, marking each canceled
workflowSpan.endTree({ attributes: { status: 'canceled' } });
```

An ended span is now final: later `span.end()` and `span.error()` calls are ignored. A span that was force-closed this way keeps the state it was closed with and reports its end exactly once, even if the work it covered finishes or fails afterwards.
