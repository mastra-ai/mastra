---
'@mastra/core': patch
---

Preserve `undefined` for missing token counts in native usage aggregation instead of coercing them to zero.

Previously, when one model step reported a token count (e.g. `inputTokens`) and another omitted it, the aggregation summed the missing value as zero, producing a misleading partial total that looked complete. Durable agents could report zero-filled usage even when every step omitted a primary count.

Now aggregate `inputTokens` and `outputTokens` stay `undefined` if any contributing step omits that count. `totalTokens` is derived only when both aggregate input and output counts are known (and is never fabricated from zero-filled parts), so downstream consumers (budget scorer, traces, callbacks) can distinguish an unknown count from a measured zero. A measured zero remains a known value. Late-finish metadata no longer certifies a count that an earlier step left unknown. `accumulatedUsageSchema` fields are now optional, so legacy durable rows with numeric usage remain valid.
