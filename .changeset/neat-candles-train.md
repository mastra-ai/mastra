---
'@mastra/factory': patch
---

Improved board polling: the Factory now answers 304 Not Modified when the work-item list has not changed since the last poll, and the board UI revalidates with If-None-Match so unchanged polls carry no body and trigger no re-render.
