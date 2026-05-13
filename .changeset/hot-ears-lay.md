---
'@mastra/core': patch
---

Channels now route messages through the new agent signals API. Each Mastra thread shares a single `agent.subscribeToThread()` subscription, and incoming platform messages are sent as `user-message` signals via `agent.sendSignal()`. Messages that arrive while the agent is busy are delivered into the running loop instead of starting a new run, which prevents conflicting concurrent streams on the same channel thread. A new `AgentChannels.close()` method tears down all cached subscriptions for graceful shutdown.
