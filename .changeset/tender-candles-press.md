---
'@mastra/core': patch
---

Fixed agents no longer responding after a tool suspended for input when chatting over the signal transport (the Studio default). Messages sent while a run was parked on a non-approval tool suspension were accepted but silently queued onto the parked run, which could never read them — so with autoResumeSuspendedTools enabled the answer to the tool's question never reached the model and the thread stayed blocked until an internal timeout expired. Follow-up messages now start a fresh run that carries the user's answer, letting auto-resume pick up the suspended tool. Approval suspensions still queue messages as before, since approving or declining resumes the run and delivers them.
