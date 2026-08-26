---
'@mastra/factory': patch
---

Fixed the chat composer losing track of whether the agent is running. Three ways the composer and the server could disagree are now reconciled:

- A slow session-state fetch could finish after a newer run-start or run-end event and overwrite it, leaving the composer spinning on an idle agent or silent on a running one. Live events now win over stale fetches.
- Reconnecting after a dropped stream now re-fetches the run state, so anything that happened during the gap is picked up.
- A sent message used to keep the composer busy until a run-end event arrived; if that event was lost in a stream gap, it stayed busy forever. A fresh snapshot saying the agent is idle now releases it.
