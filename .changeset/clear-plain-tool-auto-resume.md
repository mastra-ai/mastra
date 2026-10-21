---
'@mastra/core': patch
---

Fixed `autoResumeSuspendedTools` leaving a resumed plain tool marked as suspended. This happened when the model resumed a regular (non-agent, non-workflow) tool under a new tool call id. The original suspension was never cleared. Every later turn asked the model to resume the tool again. Reloaded clients also showed the call as still pending. The original suspension is now cleared, and a `tool-call-resumed` chunk is emitted for it. This applies to the standard, evented and durable agents.
