---
'@mastra/core': patch
---

Fixed a thread breaking for good after a reply was aborted with OpenAI Responses models. Memory kept OpenAI item ids from the unfinished response, so every later turn failed with `Item with id 'rs_…' not found`. The streamed reasoning and text are still saved, without those ids. Fixes #31202.
