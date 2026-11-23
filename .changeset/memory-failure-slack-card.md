---
'@mastra/factory': patch
---

When a memory-model failure stops a run, Slack threads now get the run error card (with its "Change memory model" link) instead of silence, and the run is reported to its followers and the session that started it as failed, quoting the failure. Runs a person stopped still say nothing.
