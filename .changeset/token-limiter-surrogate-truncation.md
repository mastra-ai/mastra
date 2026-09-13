---
'@mastra/core': patch
---

`TokenLimiterProcessor` no longer emits invalid UTF-16 when truncating output. `processOutputResult` cut assistant text with a bare `sliceByTokens` call, and that cut can land inside a surrogate pair, leaving a lone surrogate in the persisted message — it does not survive a UTF-8 round-trip (degrading to `U+FFFD` once written to storage or sent over the wire) and strict JSON parsers reject it outright, so a truncated reply replayed as history could fail the next request. The truncated text is now repaired the same way `output-helpers.ts` already repairs workspace tool output, which was the only other `sliceByTokens` call site in the monorepo.
