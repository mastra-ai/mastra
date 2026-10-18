---
'@mastra/code-sdk': patch
---

Fixed headless runs reporting success while a tool was still waiting for an answer. When a tool such as `request_access` paused the run, `runMC` stopped with `status: 'completed'` and exit code `0`, so the answer from the permission policy was never applied. Headless runs now wait for the paused run to stop, send the policy's answer, and keep running until the resumed run finishes. If a paused tool can't be resumed, the run ends with `status: 'error'` and exit code `1` instead of reporting success.
