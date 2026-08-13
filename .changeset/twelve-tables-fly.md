---
'@mastra/observability': patch
---

Added `span.endTree()` for closing a span together with every descendant span that is still open, so an operation that is abandoned rather than completed can still emit a full trace.

```ts
// Ends the span and any child spans still open beneath it
workflowSpan.endTree({ attributes: { status: 'canceled' } });
```

Repeat calls to `span.end()` are now ignored. A span that was force-closed this way reports its end exactly once, even if the work it covered finishes later and ends the span again.
