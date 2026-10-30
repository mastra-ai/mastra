---
'@mastra/core': patch
---

Agent runs that hit `modelSettings.timeout.totalMs` now save their work to memory on every engine (default, filesystem, durable, evented and Inngest). Completed steps are saved at the deadline even when `savePerStep` is off. A tool still running at the deadline gets the abort grace period to stop. Its step is then saved with the tool call and an abort notice instead of the late return value. Memory output processors run on this save, so observational memory and custom history stores see the turn too. The user's message is saved even if its save was still in flight when the deadline hit.

The caller still sees exactly one `MastraTimeoutError`. It is delayed until the save completes or its wait runs out, by up to about 1.5 seconds, so a stuck memory store cannot hold the error back.
