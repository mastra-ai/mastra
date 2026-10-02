---
'@mastra/memory': patch
---

Observational Memory no longer blocks an agent step on the Observer as soon as unobserved messages reach `messageTokens` with async buffering enabled. Between `messageTokens` and `observation.blockAfter` (default `1.2`, so 36k tokens with the default 30k threshold), background buffering keeps running and the next ready chunk activates on a later step. A blocking synchronous observation now runs only at or above `blockAfter` when no buffered chunk activates. Previously, reaching the threshold without a ready chunk forced a blocking Observer call, and buffering couldn't start above the threshold, so long agent sessions blocked on observation turn after turn.

Unobserved messages can now grow up to `blockAfter` before a step blocks. To keep the previous behavior of observing synchronously at the threshold, set `blockAfter: 1`:

```ts
observationalMemory: {
  observation: { messageTokens: 30_000, blockAfter: 1 },
}
```

A multiplier `blockAfter` now scales a per-thread `messageTokens` override instead of the instance threshold. With `blockAfter: 1.2`, this thread blocks at 3,600 tokens:

```ts
await memory.updateObservationalMemoryConfig({
  threadId,
  config: { observation: { messageTokens: 3_000 } },
});
```

`getStatus()` also returns `observationBlockAfter` and `inAsyncObservationBand`.

Fixed semantic recall missing a turn's new user message when background buffering picked it up on the first step.
