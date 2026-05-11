---
'@mastra/memory': patch
---

Auto-recover from transient transport errors (e.g. undici `terminated`, `fetch failed`, `UND_ERR_*`, 5xx, 429) in the OM observer and reflector LLM calls. Adds an internal retry wrapper with exponential backoff capped at 2 minutes (~5 minute total budget per call) so a single network blip from any provider no longer kills the actor turn during long-running sessions. Non-transient errors (auth, validation, etc.) and user-initiated aborts still fail fast. No public API changes.
