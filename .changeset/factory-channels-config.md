---
'@mastra/factory': minor
---

`MastraFactoryConfig` accepts a `channels` instance, attached to the agent controller during `prepare()`. Previously channels had to be wired by reaching into the prepared args for the controller and calling `setChannels()` on it, which only worked if it happened before `new Mastra(...)` — the constructor that initializes them. Passing them as config makes that ordering guaranteed rather than conventional.
