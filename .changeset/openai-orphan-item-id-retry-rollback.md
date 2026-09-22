---
'@mastra/core': patch
---

Fixed a processor-forced mid-turn retry discarding steps the assistant had already completed. When an output processor aborted a step with `{ retry: true }`, the whole in-flight assistant message was deleted. That took the reasoning and tool calls from earlier steps in the same turn that had already been accepted. The retry now discards only the rejected step. The model still never re-sees the rejected answer, and it keeps every step it had already accepted.

Two things stop happening on this retry path as a result. An accepted tool call is no longer thrown away and run a second time. And with OpenAI reasoning models, the saved message no longer ends up carrying an assistant `itemId` (`msg_…`) with no matching `reasoning` item. OpenAI rejects that shape with a non-retryable HTTP 400: `Item 'msg_…' of type 'message' was provided without its required 'reasoning' item`. The rejection then recurs whenever that stored history is replayed on a later turn (#22291).
