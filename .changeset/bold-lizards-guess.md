---
'@mastra/core': patch
---

Fixed silent error swallowing when agent.stream() fails during idle-start, continuation, or pending-idle signal processing. Errors now propagate to the subscription stream via a new run-failed event, so harness consumers (like MastraCode) surface proper error events instead of silently completing with no response.
