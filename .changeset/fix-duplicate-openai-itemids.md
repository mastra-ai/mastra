---
"@mastra/core": patch
---

fix(core): deduplicate all OpenAI itemIds in message sanitization to prevent "Duplicate item found" errors

Extends the existing text-part deduplication in `sanitizeV5UIMessages` to handle all part types
(reasoning, tool-call, etc.) with OpenAI `providerMetadata.openai.itemId`. Previously, only text
parts with duplicate `itemId` values were merged. Reasoning parts with duplicate `rs_*` IDs were
passed through, causing OpenAI to reject requests with "Duplicate item found with id rs_...".

This issue manifests when Observational Memory's async buffering is enabled, as the same response
parts can appear multiple times in the message history — either within a single message (from merge
operations) or across multiple non-merged assistant messages loaded from memory.

The fix:
1. Renames `mergeTextPartsWithDuplicateItemIds` → `deduplicatePartsWithOpenAIItemIds` to reflect
   broader scope
2. Text parts still merge by concatenating content (existing behavior)
3. Non-text parts with duplicate itemIds keep only the first occurrence
4. Adds cross-message deduplication via `globalSeenItemIds` to catch duplicates spanning
   multiple assistant messages

Fixes #15617
