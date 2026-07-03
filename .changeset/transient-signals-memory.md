---
'@mastra/memory': minor
---

Honor `transient: true` on agent signals at save time.

Transient signals are now dropped in `saveMessages` and `persistMessages`, so they're delivered to the model for the current call but never written to thread storage.
