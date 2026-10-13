---
'@mastra/memory': patch
---

Fixed Observational Memory injecting the continuation hint on threads that have no observations yet when retrieval is enabled. The hint (a synthetic user message telling the model earlier context was summarized) now only appears once observations have actually replaced messages. Fixes #26562
