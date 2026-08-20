---
'@mastra/factory': patch
---

Fixed the chat jumping every time a session's stream hiccuped. Losing the connection used to push a banner above the transcript and shove every message down; the reconnect state now lives only in the status line under the composer, where the model and token readouts already are.

The state is also honest during a run: a drop while the agent works used to stay hidden behind the working indicator, and now shows as `Reconnecting…`. A connection lost for good reads as `Disconnected` in the alert color.
