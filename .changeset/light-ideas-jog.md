---
'@mastra/core': patch
---

Fixed `DurableAgent` and `EventedAgent` answering two messages on the same thread at the same time. A second `stream()` or `generate()` call on a busy thread now waits for the run in progress, as it already did for a regular agent, so replies are saved in the order of the conversation. See [#30069](https://github.com/mastra-ai/mastra/issues/30069).

The wait now also works across server instances that share a PubSub with leases, such as Redis Streams. This applies to regular agents too.

If the lease backend can't be reached, a run on a thread now fails to start. Before, it started and was stopped once its lease lapsed.
