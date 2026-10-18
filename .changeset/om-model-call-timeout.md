---
'@mastra/memory': patch
---

Observational memory now aborts and retries an Observer, Reflector, or extraction model call that produces no output for 5 minutes. Before, a provider that accepted the request but never answered could stall the call indefinitely, holding up the thread's observation work. The limit measures silence, not total duration, so long replies that keep streaming are never cut off.
