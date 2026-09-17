---
'@mastra/core': patch
---

Fixed cancellation during session startup so cancelled requests do not reach the model or interrupt a newer turn. Added the provider finish reason to AgentController error events so clients can distinguish token limits and refusals from execution failures.
