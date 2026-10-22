---
'@mastra/memory': patch
---

Fix observational memory so `failurePolicy: 'continue'` keeps an agent turn running with prior memory context after observation or storage failures. Final-message save failures still return an error.
