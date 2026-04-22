---
'@mastra/memory': minor
'@mastra/core': patch
'mastracode': patch
---

Added opt-in temporal-gap markers for observational memory. When enabled via `observationalMemory.temporalMarkers: true`, the agent receives a `<system-reminder type="temporal-gap">` before any user message that arrives more than 10 minutes after the previous one, so it can anchor responses in real elapsed time. Markers are persisted, surfaced to the observer, and rendered by the MastraCode TUI on reload.
