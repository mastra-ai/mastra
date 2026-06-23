---
'@mastra/playground-ui': patch
---

Add an optional `contextWindow` prop to `MemoryStudioPanel` so callers can supply authoritative message/observation token counts and thresholds. When provided, these take precedence over the values re-derived from message markers, keeping the timeline panel's MESSAGES/OBSERVATIONS readout in sync with the observational-memory sidebar. Marker-derived values remain the fallback for standalone usage.
