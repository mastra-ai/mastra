---
'@mastra/playground-ui': patch
---

Fixed `MessageScroller` with `autoScroll` not following the first reply in a new conversation. A conversation that opens at its end now follows what streams in next. A following reader also stays at the end when the scroller gets shorter, for example when a composer grows while typing.
