---
'@mastra/server': patch
---

Fixed the agent-controller SSE stream so clients that connect while a run is already in progress see the current state right away. The stream now sends the session's display state as its first event, so a reloaded page or a second tab immediately shows the running tool, the streaming reply and any pending approval or question instead of waiting for the next event.
