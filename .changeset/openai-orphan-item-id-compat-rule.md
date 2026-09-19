---
'@mastra/core': patch
---

Add an `openai-orphan-item-id` compat rule so a turn can recover when stored history contains an assistant message with an OpenAI `itemId` (`msg_…`) but no `reasoning` item. OpenAI's Responses API replays such a message as an `item_reference` and rejects the request with a non-retryable 400 (`Item 'msg_…' of type 'message' was provided without its required 'reasoning' item`), which today ends the turn.

The rule strips the offending `itemId` so the message replays by value, and retries. The repair is **in-memory for the current turn**: the healed message is not written back to storage, so each later turn on that thread still spends one rejected request before recovering — the same behavior as the existing `anthropic-tool-id-format` rule.

The rule is not automatic: install `ProviderHistoryCompat` on the agent — a plain `Agent` has no compat processor configured. Install it in `errorProcessors`. The API-error hook itself runs from any processor list, but the retry a reactive rule asks for is only honored when the agent has a retry budget, and that budget is left `undefined` unless `errorProcessors` is configured or `maxProcessorRetries` is set. An input-only installation without an explicit `maxProcessorRetries` repairs the history and still loses the turn.

```ts
import { Agent } from '@mastra/core/agent';
import { ProviderHistoryCompat } from '@mastra/core/processors';

const agent = new Agent({
  // ...
  errorProcessors: [new ProviderHistoryCompat()],
});
```

Reactive by design: it fires only after that specific error, so it never fires on a thread that has not hit this error. Once it does fire it strips every orphan-shaped message in that history, since the error names only the first item OpenAI tripped over and only one retry is available; valid reasoning-free messages caught that way still replay correctly, by value rather than by reference. One exception: a hosted `tool_search` part cannot replay by value, so it is dropped from the prompt once its ids are gone. On a genuine orphan that is correct. On a swept-along valid message it costs that search result, which the model can look up again.

Within such a message it clears every item reference, not only the one on the text part: a tool call beside it is orphaned for the same reason, and leaving its id behind would spend the single retry to arrive at the same error one item further down. Reading and stripping go through the shared Responses helpers, so the `azure` namespace is covered alongside `openai`, and both the `providerMetadata` and `providerOptions` containers are cleared. A merged tool part also carries the result half of its pair under `resultItemId`, which conversion turns back into an `itemId` on the tool-result part, so that key is removed too. Nothing else in the namespace is touched — cache counts, reasoning-token counts and logprobs are left intact.
