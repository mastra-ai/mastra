---
'@mastra/core': minor
---

**Behavior change:** `SystemPromptScrubber` and `ModerationProcessor` now buffer streamed text before they call their LLM. Before, they made one LLM call for every text chunk, so a 200-token reply meant about 200 sequential model calls and streaming slowed to a few characters per second.

Now buffered text is checked in one call when it ends a sentence, reaches `bufferSize` characters (default `200`), or a non-text part arrives. Text that is split across chunks is also caught now. Before, a leaked phrase split over two chunks could get past redaction.

Text reaches the client in sentence-sized pieces instead of token by token. To keep the old one-call-per-chunk behavior, set `bufferSize: 0`:

```ts
new SystemPromptScrubber({ model, bufferSize: 0 })
new ModerationProcessor({ model, bufferSize: 0, chunkWindow: 2 })
```

`chunkWindow` on `ModerationProcessor` only applies when `bufferSize` is `0`. `PIIDetector` already buffered its LLM checks and does not change.
