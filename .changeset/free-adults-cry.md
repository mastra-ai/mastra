---
'@mastra/playground-ui': patch
'@mastra/react': patch
---

Fixed Observational Memory badges not updating when a stream is interrupted or after a page reload. The helpers that mark badges disconnected, inject buffering completion, and restore activation on load were reading a flat message shape and silently did nothing on the canonical stored message; they now read `content.parts` and are typed against `MastraDBMessage` so the compiler enforces the shape.
