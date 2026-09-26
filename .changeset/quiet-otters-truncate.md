---
'@mastra/memory': patch
---

Fixed Observational Memory discarding a whole observation cycle when the model's summary contained one very long line, such as a minified payload. Long non-repeating lines are now shortened instead, and the surrounding observations are kept (#24354).
