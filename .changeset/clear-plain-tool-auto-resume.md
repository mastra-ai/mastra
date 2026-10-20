---
'@mastra/core': patch
---

Fixed `autoResumeSuspendedTools` leaving a resumed plain tool marked as suspended. When the model resumed a regular (non-agent, non-workflow) tool under a new tool call id, the original suspension was never cleared, so every later turn asked the model to resume it again and reloaded clients showed the call as still pending. The original suspension is now cleared and a `tool-call-resumed` chunk is emitted for it, on the standard, evented and durable agents.
