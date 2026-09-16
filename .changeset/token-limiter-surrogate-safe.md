---
'@mastra/core': patch
---

Fixed `TokenLimiterProcessor` truncation (`strategy: 'truncate'`) splitting UTF-16 surrogate pairs.

Truncated text that ends inside an emoji or other astral character no longer contains a lone surrogate. Lone surrogates are replaced with `U+FFFD`, so the output round-trips through UTF-8 unchanged and strict JSON consumers can reuse truncated messages as history. This matches the repair already applied to workspace tool output.
