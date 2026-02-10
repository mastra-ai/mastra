---
'@mastra/core': patch
---

Fixed an issue where processor retry (via `abort({ retry: true })` in `processOutputStep`) would send the rejected assistant response back to the LLM on retry. This confused models and often caused empty text responses. The rejected response is now removed from the message list before the retry iteration.
