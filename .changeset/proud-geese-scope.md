---
'@mastra/core': patch
---

Fixed an issue where multiple agents sharing one storage instance would all respond in a subscribed channel thread instead of just the agent that was mentioned. Each agent now tracks its own channel threads and subscriptions.
