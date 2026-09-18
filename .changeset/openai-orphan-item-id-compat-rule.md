---
'@mastra/core': patch
---

Add an `openai-orphan-item-id` compat rule so a turn can recover when stored history contains an assistant message with an OpenAI `itemId` (`msg_…`) but no `reasoning` item. OpenAI's Responses API replays such a message as an `item_reference` and rejects the request with a non-retryable 400 (`Item 'msg_…' of type 'message' was provided without its required 'reasoning' item`), which today ends the turn.

The rule strips the offending `itemId` so the message replays by value, and retries. The repair is **in-memory for the current turn**: the healed message is not written back to storage, so each later turn on that thread still spends one rejected request before recovering — the same behavior as the existing `anthropic-tool-id-format` rule.

Reactive by design: it fires only after that specific error, so legitimately reasoning-free messages (`reasoning.effort: 'none'`, non-reasoning models) are untouched. It strips only `itemId`, leaving other `providerMetadata.openai` fields intact.
