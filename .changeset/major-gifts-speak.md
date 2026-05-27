---
'@mastra/core': patch
---

End the AGENT_RUN observability span when an agent stream suspends for human-in-the-loop tool approval (`tool-call-approval`) or tool `suspend()` (`tool-call-suspended`). Previously these terminations left the span open, so traces never reached observability backends like Langfuse, Braintrust, or Datadog. The span output now includes the suspend reason, tool name, and tool call ID.
