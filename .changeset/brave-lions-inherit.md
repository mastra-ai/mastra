---
'@mastra/code-sdk': patch
---

Mastra Code no longer wires its own prefill error processor, a duplicate provider-history copy in its input lane, or a positional `ProviderHistoryCompat` in its error lane. It names only its tuned stream-retry policy and inherits the rest from the `@mastra/core` shared defaults, which place each one at the position its id gives it.
