---
'mastra': patch
---

The Factory sidebar now rereads only the cards and sessions a board stream frame names, instead of downloading every session's cards on each change. A frame that names nothing specific, a reconnect, or a failed narrow read still rereads the whole list. While the stream is connected, the one-minute safety poll no longer rereads the session list.
