---
'@mastra/react': patch
---

Added handling for `reasoning-start` and `reasoning-end` stream chunks in `toUIMessage` so reasoning blocks correctly open and close while the agent streams. Previously only `reasoning-delta` was handled, which could leave reasoning UI in an inconsistent state across providers that emit explicit start/end events.
