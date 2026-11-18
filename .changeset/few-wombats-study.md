---
'@mastra/core': patch
---

A `stream()` or `generate()` call on a busy thread now also waits when the run in progress is on another server instance. This works with any PubSub that has leases, such as Redis Streams, and applies to regular, durable and evented agents. See [#30069](https://github.com/mastra-ai/mastra/issues/30069).

If the lease backend can't be reached, a run on a thread now fails to start. Before, it started and was stopped once its lease lapsed.
