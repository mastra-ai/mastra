---
'@mastra/laminar': patch
---

Fixed trace state that was never freed when `spanFilter` dropped the end of a span.
