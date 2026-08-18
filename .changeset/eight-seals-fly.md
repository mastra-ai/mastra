---
'@mastra/factory': patch
---

Fixed the Factory chat transcript drawing the same content twice after coming back to a tab. While a run streams, leaving the tab drops the event stream and the transcript refetches on return: an assistant reply the server had persisted as its own step, and a steer whose live event was missed, both landed on screen a second time. The refetched window is now paired against what is already drawn — by message id, by tool call, then by the text itself — so it only inserts what is genuinely missing.

Also fixed a tool call rendering as two half-filled cards when a steer interrupted it: live tool state followed the newest assistant message instead of staying with the call it belongs to.
