---
'@mastra/code-sdk': patch
---

Fixed the server-owned Mastra instance created by prepareAgentControllerMount ignoring a configured PubSub. When you pass a distributed pubsub (for example Redis Streams) to the agent controller, the mounted Mastra now runs its event bus on the same transport, so streams, workflows, and signals work across multiple server processes.
