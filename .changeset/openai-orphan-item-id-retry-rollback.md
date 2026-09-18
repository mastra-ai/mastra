---
'@mastra/core': patch
---

Fixed a processor-forced mid-turn retry discarding the accepted part of the assistant's turn. When an output processor aborted with `{ retry: true }`, the whole in-flight assistant message was deleted, taking the reasoning and tool calls from earlier steps that had already been accepted. The retry now discards only the rejected step, so the model never re-sees the rejected answer but keeps every step it had already accepted.

Two things stop happening on this retry path as a result. An accepted tool call is no longer thrown away and re-executed on the retry. And with OpenAI reasoning models, the saved message no longer ends up carrying an assistant `itemId` (`msg_…`) with no matching `reasoning` item — a shape OpenAI rejects on the next turn with a non-retryable HTTP 400 (`Item 'msg_…' of type 'message' was provided without its required 'reasoning' item`), which then recurs whenever that corrupted history is replayed on a later turn (#22291).
