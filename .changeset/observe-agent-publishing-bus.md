---
'@mastra/server': patch
---

Observe agent streams through the agent's subscription hook or publishing bus instead of guessing a transport from the global Mastra pubsub. Built-in durable, evented, and Inngest agents retain their own delivery contracts, including legacy raw-topic replay.

Custom structural durable adapters must expose either `__subscribeToRunStream` or `pubsub` for observation. After run authorization, adapters exposing neither now return HTTP 501 before opening a stream, rather than silently subscribing to a potentially unrelated global transport.
