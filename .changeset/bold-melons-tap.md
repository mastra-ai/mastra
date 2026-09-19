---
'@mastra/core': minor
---

Default agents now recover from transient provider failures, assistant-prefill rejections, and provider history incompatibilities without extra configuration. A processor you supply with the same id is used instead of the matching default. Each added default is placed at the position its id gives it, so naming only one of the three still resolves them in the order that makes each repair run before the failures it prevents, and your own processors are never reordered relative to each other. Pass `errorProcessors: []` to run with no error processors at all.

Error-phase processors now also run in the LLM request lane, so a `ProviderHistoryCompat` placed in `errorProcessors` applies its preemptive prompt rules as well as its reactive API-error recovery.
