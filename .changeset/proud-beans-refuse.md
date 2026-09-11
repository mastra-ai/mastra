---
'@mastra/core': patch
---

Fixed evented agent streams losing events when the agent uses a custom pubsub. The evented workflow engine publishes run events on the Mastra instance's pubsub, but the agent's stream listened only on its own pubsub — with a custom pubsub configured, suspend, finish, and tool events silently never reached the stream. The agent's caching pubsub now also follows the Mastra instance's pubsub as a source, so evented runs stream correctly regardless of which pubsub the agent was configured with.
