---
'@mastra/core': patch
---

Fixed `autoResumeSuspendedTools` leaving a resumed tool marked as suspended. When the model resumed a suspended tool from a follow-up message, the tool ran but its suspension was never cleared, so every later turn still asked the model to resume it and reloading clients still showed it as pending. The suspension is now cleared and a `tool-call-resumed` chunk is emitted for the original tool call, matching `resumeStream()`.
