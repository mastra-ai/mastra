---
'@mastra/core': patch
---

Fixed durable agents ignoring an agent-level pubsub for run streams. Durable execution now shares the wrapped Agent's stream bus, including after registration and forks, while evented runs keep using Mastra's shared transport.

**Upgrade note:** If the wrapped `Agent` has a `pubsub` that differs from `Mastra.pubsub` and no `pubsub` is passed to `createDurableAgent`, durable run streams and remote Stop now use the wrapped Agent's transport instead of Mastra's. Mastra-only configurations are unchanged. To keep old and new workers on the same transport during an upgrade, align the Agent's pubsub with Mastra's, or pass the previous transport explicitly as `createDurableAgent({ agent, pubsub: mastraPubsub })`. The wrapper configures the shared stream bus, so its override also applies to resumable streams from direct calls on the wrapped Agent.
