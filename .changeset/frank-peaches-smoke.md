---
'@mastra/factory': patch
---

Fixed Factory review kickoffs being marked as sent when the wake signal never reached the agent. Skill kickoffs now wait for the agent to accept the signal and automatically retry when delivery fails (for example when a platform sandbox is unreachable), so review sessions no longer end up as empty threads.
