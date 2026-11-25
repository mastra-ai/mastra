---
'@mastra/server': patch
---

A workflow request whose run was taken over by another instance now gets a 409 that says so, instead of a 500. The body is `{ error, code: 'STORAGE_RUN_FENCE_CONFLICT' }`. Its message names the run and says to read it for its current state, and leaves out the other instance's claim details. Routes that start, resume, restart or time travel a run in the background no longer log such a takeover as an error.
