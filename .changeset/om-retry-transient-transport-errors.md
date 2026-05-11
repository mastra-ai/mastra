---
'@mastra/memory': patch
---

Auto-recover from transient transport errors (e.g. undici `terminated`, `fetch failed`, `UND_ERR_*`, 5xx, 429) in the OM observer and reflector LLM calls. Adds an internal retry wrapper with exponential backoff (1s, 2s, 4s, 8s, 16s, 32s, 64s, 120s — per-attempt delay capped at 2 minutes, ~4 minute total budget per call) so a single network blip from any provider no longer kills the actor turn during long-running sessions. Non-transient errors (auth, validation, etc.) and user-initiated aborts still fail fast. No public API changes.
