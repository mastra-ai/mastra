---
'@mastra/core': patch
---

Fix an output processor's forced mid-turn retry destroying the accepted part of the in-flight assistant message. When a processor aborted with `{ retry: true }`, the retry path deleted the whole assistant message, so reasoning and tool-invocation parts from earlier, already-accepted steps of the same turn were lost along with the rejected answer. The retry now rolls the message back only to the last step boundary, via a new `MessageList#rollbackToLastStepBoundary()` primitive; the rejected attempt's parts are still removed, so the model never re-sees them.

With OpenAI reasoning models this had two consequences: the persisted message could keep an assistant `itemId` (`msg_…`) with no accompanying `reasoning` item, which OpenAI rejects on replay with a non-retryable HTTP 400 (`Item 'msg_…' of type 'message' was provided without its required 'reasoning' item`), permanently breaking that thread; and in the more common case the accepted tool call was silently discarded and re-executed on the retry.
