---
'@mastra/playground-ui': patch
---

The spans list keeps updating live when a tab stays open for hours. Live updates used to keep the list's start and move its end to now, so the requested time range kept growing until the server refused it (the hosted API limits word search to 7 days), which silently stopped live updates. Each live update now moves the start forward with the end, keeping the range the same length. If the server still refuses a live update, a note under the filter bar says live updates are paused, and `useSpansListSource` returns the refusal as `liveUpdatesError`.
