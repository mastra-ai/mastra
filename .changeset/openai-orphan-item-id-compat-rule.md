---
'@mastra/core': patch
---

Add an `openai-orphan-item-id` compat rule so a turn can recover when stored history contains an assistant message with an OpenAI `itemId` (`msg_…`) but no `reasoning` item. OpenAI's Responses API replays such a message as an `item_reference` and rejects the request with a non-retryable 400 (`Item 'msg_…' of type 'message' was provided without its required 'reasoning' item`), which today ends the turn.

The rule strips the offending `itemId` so the message replays by value, and retries. The repair is **in-memory for the current turn**: the healed message is not written back to storage, so each later turn on that thread still spends one rejected request before recovering — the same behavior as the existing `anthropic-tool-id-format` rule.

The rule is not automatic: install `ProviderHistoryCompat` on the agent — a plain `Agent` has no compat processor configured. Install it in `errorProcessors`: the API-error hook can fire from other lanes, but an input-only installation is not sufficient across execution modes — it can repair the history and still lose the turn.

```ts
import { Agent } from '@mastra/core/agent';
import { ProviderHistoryCompat } from '@mastra/core/processors';

const agent = new Agent({
  // ...
  errorProcessors: [new ProviderHistoryCompat()],
});
```

Reactive by design: it fires only after that specific error, so it never fires on a thread that has not hit this error. Once it does fire it strips every orphan-shaped message in that history, since the error names only the first item OpenAI tripped over and only one retry is available; valid reasoning-free messages caught that way still replay correctly, by value rather than by reference. It strips only `itemId`, leaving other `providerMetadata.openai` fields intact.
