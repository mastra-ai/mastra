---
'@mastra/memory': patch
---

Honor observational memory's `failurePolicy: 'continue'` when input-step observation or storage fails. Keep the current agent turn running with its previous memory context, but surface a failed final message save and avoid retrying the failed observer on context overflow.
