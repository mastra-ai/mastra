---
'mastra': patch
---

Fixed the Factory chat transcript rolling back mid-stream. A streamed message snapshot that arrived stale or out of order could replace an assistant bubble with a shorter version of itself, so text already on screen visibly regressed and then grew back. Text already drawn is now kept when an incoming snapshot for the same message would lose it, while that snapshot's other updates — closing out the message and recording why it stopped — still apply.
