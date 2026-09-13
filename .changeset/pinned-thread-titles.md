---
'@mastra/core': patch
'@mastra/memory': patch
---

Observational Memory no longer overwrites a manually renamed thread title. `session.thread.rename()` pins the title by default (thread metadata `titlePinned`), all three OM strategies (`sync`, `asyncBuffer`, `resourceScoped`) respect the pin through a shared `resolveThreadTitleUpdate` helper, and an explicit `generateThreadTitle()` regenerate clears the pin so auto-naming resumes. Fixes #22421
