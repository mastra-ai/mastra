---
'@mastra/memory': patch
---

Fixed Observational Memory read-only calls writing to storage. `loadUnobservedMessages()` and `pruneObserved()` no longer create an Observational Memory record when a thread has none yet; they treat the thread as having nothing observed. Write paths such as `observe()` still create it.
