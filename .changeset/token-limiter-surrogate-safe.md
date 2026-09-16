---
'@mastra/core': patch
---

Fix `TokenLimiterProcessor` truncation (`strategy: 'truncate'`) splitting UTF-16 surrogate pairs. When a truncation boundary landed inside a multi-byte character (e.g. an emoji), the output could contain an unpaired surrogate, producing invalid UTF-16 that fails a UTF-8 round-trip and can break downstream consumers with strict JSON parsers. Truncated text now has any lone surrogates replaced with the Unicode replacement character (`U+FFFD`), matching the existing policy used for workspace tool output.
