---
'@mastra/core': patch
---

Add an `openai-orphan-item-id` compat rule so a thread whose stored history already contains an assistant message with an OpenAI `itemId` (`msg_…`) but no `reasoning` item can recover instead of failing on every turn. OpenAI's Responses API replays such a message as an `item_reference` and rejects the request with a non-retryable 400 (`Item 'msg_…' of type 'message' was provided without its required 'reasoning' item`), which otherwise repeats indefinitely because the offending message is persisted.

The rule is reactive — it fires only after that specific error, so legitimately reasoning-free messages (`reasoning.effort: 'none'`, non-reasoning models) are untouched. It strips only `itemId`, leaving other `providerMetadata.openai` fields (cache counts, reasoning-token counts, logprobs) intact, and skips messages whose reasoning item sits on the preceding assistant row. It is available on agents using the `ProviderHistoryCompat` processor.
