---
'@mastra/memory': patch
---

Added an opt-in observational-memory failure policy. Set `observation.onFailure` to `'continue'` to report an Observer model or provider failure, keep unobserved input pending, and continue the main agent turn after one attempt. The default `'abort'` behavior and retry schedule are unchanged, and non-provider failures remain fatal.
