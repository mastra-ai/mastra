---
'@mastra/memory': patch
---

Fixed Observational Memory crashing when stored conversation history contains a failed tool call with a structured error instead of a text message. Both token counting and the observer now handle these errors, so Observational Memory keeps working on later turns instead of stopping. Fixes #28407.
