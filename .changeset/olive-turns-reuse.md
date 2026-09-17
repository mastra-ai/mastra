---
'@mastra/memory': patch
---

Fixed Observational Memory failing multi-step agent loops with `Turn already ended`. When a turn was sealed before the loop reached its next step — or before the run finalized — the ended turn could be reused and throw, failing the whole agentic loop. Ended turns are now discarded so the next step starts a fresh one, and finalization persists the remaining messages instead of failing. Fixes #19740.
