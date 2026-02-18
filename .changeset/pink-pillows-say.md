---
'@mastra/ai-sdk': patch
---

Fixed chatRoute to pass the request's abort signal to the agent, so client-side cancellation (e.g., user clicking stop) now properly stops LLM generation on the server instead of running to completion. Closes #13038.
