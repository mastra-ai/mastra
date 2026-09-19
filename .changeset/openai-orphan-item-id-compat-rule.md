---
'@mastra/core': patch
---

Add an `openai-orphan-item-id` compat rule so a turn can recover when stored history contains an assistant message with an OpenAI `itemId` (`msg_…`) but no `reasoning` item. OpenAI's Responses API replays such a message as an `item_reference` and rejects the request with a non-retryable 400 (`Item 'msg_…' of type 'message' was provided without its required 'reasoning' item`), which today ends the turn.

**What changes for you.** A thread that was permanently stuck on that 400 can now recover on the same turn. The rule removes the item references from every message shaped like the orphan so they replay by value, then asks for one retry. Azure is covered on the same footing as OpenAI. Unrelated provider data survives the repair: cache counts, reasoning-token counts and logprobs are left intact.

**You have to install it.** A plain `Agent` has no compat processor configured. Register `ProviderHistoryCompat` in `errorProcessors` — reactive recovery needs the error lane, and on the durable path the API-error pass runs only when that list is non-empty.

```ts
import { Agent } from '@mastra/core/agent';
import { ProviderHistoryCompat } from '@mastra/core/processors';

const agent = new Agent({
  // ...
  errorProcessors: [new ProviderHistoryCompat()],
});
```

**The repair is in-memory for the current turn.** The healed message is not written back to storage, so each later turn on that thread still spends one rejected request before recovering — the same behavior as the existing `anthropic-tool-id-format` rule.

**It fires only after that error,** never on a thread that has not hit it. When it does fire it repairs every orphan-shaped message in the history, because the error names only the first item and one retry is available. Valid reasoning-free messages caught by that breadth still replay correctly, by value rather than by reference. One exception: a hosted `tool_search` result cannot replay by value, so it is dropped from the prompt rather than replayed. On a genuinely orphaned message that is the right outcome; on a valid message swept along with it, the model loses that search result and would have to look it up again.
