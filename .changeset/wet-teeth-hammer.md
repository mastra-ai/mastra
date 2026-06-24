---
'@mastra/playground-ui': patch
'@mastra/playground': patch
---

Move the Memory Studio (timeline, flamegraph, and observational-memory detail) into the agent chat view as an opt-in panel.

- The standalone Memory nav entry, `/memory` routes, and the separate thread/chat list are removed; the studio is now opened from the chat view and shown inside the Memory sidepanel, with the agent layout's left resizable panel expanding when the detail opens. Clicking the flamegraph timeline drives a replay cursor that highlights the matching observational-memory record. Marker types are imported from `@mastra/memory` instead of being redeclared in the UI so the studio stays in sync with the stream format.
- `MemoryStudioPanel` gains an optional `contextWindow` prop so callers can supply authoritative message/observation token counts and thresholds; when provided these take precedence over values re-derived from message markers, keeping the panel's MESSAGES/OBSERVATIONS readout in sync with the observational-memory sidebar (marker-derived values remain the fallback for standalone usage).
- `MemoryStudioPanel` now shows both Messages and Observations progress bars, matching the collapsed memory sidebar. The FlameGraph zoom range is lifted into the panel and filters the observation list: collapsing the range hides out-of-range observations and "Reset zoom" restores the full list. `FlameGraph` gains optional controlled `zoomRange`/`onZoomRangeChange` props (uncontrolled usage is unchanged).
