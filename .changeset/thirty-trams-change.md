---
'@mastra/core': patch
---

Fixed streaming output processors reacting to errors that the agent recovered from. Previously, an error raised by a single model call (for example a transient rate limit delivered in the response stream) was passed to every output processor immediately, before error processor retries or fallback models had a chance to recover. Processors now only see an error once the run has actually failed on it, and they see it exactly once.
