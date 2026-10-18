---
'@mastra/memory': patch
---

Observational memory now aborts and retries an Observer, Reflector, or extraction model call that runs longer than 2 minutes. Before, a provider that accepted the request but never answered could stall the call indefinitely, holding up the thread's observation work.
