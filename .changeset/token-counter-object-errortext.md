---
'@mastra/memory': patch
---

Fixed a crash in token counting when stored conversation history contains a failed tool call with a structured error instead of a text message. Observational Memory now keeps working on later turns instead of stopping. Fixes #28407.
