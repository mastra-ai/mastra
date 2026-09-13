---
'@mastra/core': patch
---

Fixed an issue where an agent stopped responding after a tool suspended for user input over the signal transport (the Studio default).

**What went wrong**

A message sent while the run was parked on a non-approval tool suspension was accepted, but it was queued onto the parked run, which could never read it. With `autoResumeSuspendedTools` enabled, the answer never reached the model and the thread stayed blocked until an internal timeout expired.

**What changed**

- A follow-up message now starts a fresh run that carries the user's answer, so auto-resume picks up the suspended tool.
- Approval suspensions keep the previous behavior. Approving or declining resumes the run and delivers the queued messages.
