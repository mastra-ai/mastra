---
'@mastra/memory': minor
---

Default-schema knowledge capture now requires a short per-fact reason, recorded as provenance metadata alongside the fact. The field was previously optional and only requested for facts the model judged non-obvious, so in practice it was almost never written. Custom capture schemas are unchanged.
