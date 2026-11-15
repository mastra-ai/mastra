---
'@mastra/memory': patch
---

Fixed Observational Memory losing every message for agents that use a `mastra/` gateway model with a Gateway organization key. The processor skipped local memory for any gateway model, but a gateway with an organization key has no memory API, so nothing was saved locally and nothing was recalled on the gateway either: the agent forgot every earlier turn. Memory now stays local when the gateway doesn't serve it, and an agent that switches between gateway-served and local memory mid-run no longer drops the messages it already collected. If saving those messages fails while the ownership switches, the storage error reaches the caller instead of the run reporting success ([#30391](https://github.com/mastra-ai/mastra/issues/30391)).

Upgrade `@mastra/core` and `@mastra/memory` together. Older `@mastra/core` versions don't report whether the gateway serves memory, so `@mastra/memory` keeps the previous behavior for them.
