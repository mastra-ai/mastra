---
'@mastra/core': patch
---

Fixed thread streams treating a run as finished while it was still waiting for a tool approval or a suspended tool. When thread updates were delivered with a delay (for example with `@mastra/redis-streams`), the thread could unblock and subscribers on other servers could lose the pending approval. The run now stays waiting until the approval or tool resumes it.
