---
'@mastra/core': patch
---

Agent runs on the default and filesystem engines that hit `modelSettings.timeout.totalMs` now save the turn to memory, not only the user's message. This replaces the `savePerStep` rule in the earlier total-timeout changeset.

- Steps that finished before the deadline are saved even when `savePerStep` is off.
- A tool call cut off by the deadline is saved with an abort notice, so the next turn sees a complete call.
- Read-only memory and memory write permissions are still respected.
- If an output processor rejects the output at the deadline, steps already saved by `savePerStep` are removed.
- The timeout error can arrive up to about 1.5 seconds after the deadline while a cut-off tool gets time to settle.
