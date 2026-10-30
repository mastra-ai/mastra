---
'@mastra/core': patch
---

Message history is now append-only. When an agent run fails or times out, memory keeps what happened in that turn (the user's message, completed steps and the error) instead of dropping it. Previously a run that errored before producing any output removed the user's message from history, so retries lost context and prompt caching broke.

Agent runs that hit `modelSettings.timeout.totalMs` on the default and filesystem engines now save the whole turn: the user's message, every step that finished before the deadline (including tool calls that completed or were cut off with an abort notice), and the text the model had already streamed. Data parts that output processors write at the end of the turn are saved too. Read-only memory and memory write permissions are respected. This replaces the 1.81.0 note that completed steps are saved only when `savePerStep` is on and unfinished steps are never saved.

`OutputResult.inputAccepted`, added in 1.81.0, is deprecated and no longer set. Processors that read or set it still type-check, but `MessageHistory` keeps every failed turn without it. To detect a failed run in a custom `processOutputResult` processor, check `result.finishReason === 'error'`.
