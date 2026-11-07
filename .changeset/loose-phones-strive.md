---
'@mastra/core': patch
---

Agent runs that hit `modelSettings.timeout.totalMs` on the default and filesystem engines now save the turn at the deadline: the user's message, every step that finished before the deadline, the tool call that was cut off with its abort notice, the text the model had already streamed, and the `data-*` parts that output processors write at the end of the turn. The save runs only after the `memory:write` check passes, and read-only memory is respected. This replaces the 1.81.0 note that completed steps are saved only when `savePerStep` is on and unfinished steps are never saved.

Removed a `MessageHistory` rule that skipped saving a failed turn with no output. Every terminal failure already records an error part on the turn, so the rule could no longer fire.

`OutputResult.inputAccepted`, added in 1.81.0, is deprecated and no longer set. Processors that read or set it still type-check. To detect a failed run in a custom `processOutputResult` processor, check `result.finishReason === 'error'`.
