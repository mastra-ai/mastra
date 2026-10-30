---
'@mastra/core': minor
---

Message history is now append-only. When an agent run fails or times out, memory keeps what happened in that turn (the user's message, completed steps and the error) instead of dropping it. Previously a run that errored before producing any output removed the user's message from history, so retries lost context and prompt caching broke.

Agent runs that hit `modelSettings.timeout.totalMs` on the default and filesystem engines now save the whole turn: the user's message, every step that finished before the deadline (including tool calls that completed or were cut off with an abort notice), and the text the model had already streamed. Data parts that output processors write at the end of the turn are saved too. Read-only memory and memory write permissions are respected. This replaces the 1.81.0 note that completed steps are saved only when `savePerStep` is on and unfinished steps are never saved.

Removed the `inputAccepted` field from `OutputResult`, added in 1.81.0. `MessageHistory` no longer needs it because failed turns are always kept. Remove any checks on `result.inputAccepted` in custom `processOutputResult` processors; a failed turn is identified by `result.finishReason === 'error'`.
