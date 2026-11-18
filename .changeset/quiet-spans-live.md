---
'@mastra/playground-ui': patch
---

The spans list keeps updating live when its rolling time range outgrows a server limit. Live updates keep the list's start and move its end to now, so after a while the request can be longer than the server allows (the hosted API limits word search to 7 days) and was refused, which silently stopped live updates. The list now reloads as the same preset ending now and carries on. If the server refuses a live update for another reason, a note under the filter bar says live updates are paused, and `useSpansListSource` returns the refusal as `liveUpdatesError`.
