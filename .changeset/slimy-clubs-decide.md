---
'@mastra/livekit': patch
---

Fixed `vad: false` to disable voice activity detection when creating a LiveKit session. LiveKit treats an omitted VAD as a request for its bundled default, so the worker now explicitly opts out. Explicit VAD instances, prewarmed Silero, and `sessionOptions` overrides keep their existing behavior.
