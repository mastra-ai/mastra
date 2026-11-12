---
'@mastra/core': patch
---

Fixed durable agents ignoring an agent-level pubsub for run streams. Durable execution now shares the wrapped Agent's stream bus, including after registration and forks, while evented runs keep using Mastra's shared transport.
