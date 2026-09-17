---
'@mastra/memory': patch
---

Fixed Observational Memory failing multi-step agent loops with `Turn already ended`. When a turn was sealed before the loop reached its next step, the ended turn could be reused and throw, failing the whole agentic loop. Ended turns are now discarded so the next step starts a fresh one. Fixes #19740.
