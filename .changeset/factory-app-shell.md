---
'@mastra/factory': patch
---

Factory pages now share one app shell instead of two near-identical private ones. The shell takes a `scroll` prop naming who owns the scrolling — `document` for pages that scroll natively, `viewport` for chat pages whose content owns nested scroll regions — so a page can no longer silently pick the wrong frame.
