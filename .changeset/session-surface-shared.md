---
'@mastra/playground-ui': minor
---

Added `SessionSurface` and `SessionComposer` so any host can render a Factory-style session page: transcript, task panel, loading veil and docked composer. The host passes the conversation as children, so its error notice can replace the older-history loader (`TranscriptHistoryLoader`), the empty state and the transcript together. Factory now renders its session page through them, with no change in behavior.
