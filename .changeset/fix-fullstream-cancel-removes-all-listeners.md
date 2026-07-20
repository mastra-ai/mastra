---
"@mastra/core": patch
---

Fix a per-subscriber `cancel()` on `WorkflowRunOutput.fullStream` and `MastraModelOutput`'s evented stream calling `removeAllListeners()` on the shared event emitter, which silently killed every other concurrent consumer of the same run (e.g. two `/stream` requests, or `/stream` + `/observe`, on the same runId). One subscriber disconnecting now only removes its own listeners; other subscribers keep receiving chunks and close normally.
