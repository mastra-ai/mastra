---
'@mastra/redis-streams': patch
'@mastra/google-cloud-pubsub': patch
---

Honor the `localOnly` publish option so in-process subscribers can receive events without round-tripping through the broker.

This matches the contract already implemented by `UnixSocketPubSub` in `@mastra/core`: when `Mastra` tags an internal workflow event as `localOnly`, the payload is delivered by reference to local subscribers and the broker is skipped entirely. Live runtime values like `MastraModelOutput` instances now keep their prototypes when the evented agent loop runs against a Redis Streams or Google Cloud Pub/Sub broker, fixing `output.consumeStream is not a function` style failures.
