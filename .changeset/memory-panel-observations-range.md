---
'@mastra/playground-ui': patch
---

Add an Observations progress bar to the observational-memory detail panel (`MemoryStudioPanel`) so it shows both Messages and Observations bars, matching the collapsed memory sidebar. The FlameGraph zoom range is now lifted into the panel and filters the observation list: collapsing the range hides out-of-range observations, and "Reset zoom" restores the full list. `FlameGraph` gains optional controlled `zoomRange`/`onZoomRangeChange` props (uncontrolled usage is unchanged).
