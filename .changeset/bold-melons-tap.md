---
'@mastra/core': minor
---

Default agents now recover from transient provider failures, assistant-prefill rejections, and provider history incompatibilities without extra configuration. A processor you supply with the same id is used instead of the matching default, and your processors keep their positions ahead of the added defaults. Pass `errorProcessors: []` to run with no error processors at all.

Error-phase processors now also run in the LLM request lane, so a `ProviderHistoryCompat` placed in `errorProcessors` applies its preemptive prompt rules as well as its reactive API-error recovery.
