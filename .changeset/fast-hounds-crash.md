---
'@mastra/factory': minor
---

Factory session names in the sidebar now follow the thread's generated title instead of freezing on the raw first prompt.

A chat session used to keep the exact text you first typed ("Tell me what have been done in the factory since…"), and a work session showed its branch ("factory/pr-22160"), even though Mastra had already named the underlying thread "PR review approval". The session row now mirrors that title from whichever namer produced it — the first turn, the observational-memory observer, or an explicit rename — and reconciles against the stored thread title whenever the session is reopened, so sessions started before this also get named.
