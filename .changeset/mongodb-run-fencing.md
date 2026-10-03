---
'@mastra/mongodb': patch
---

Added run fencing for durable agents. MongoDB stores on replica sets and sharded clusters now reject writes from a durable agent execution that lost its run to crash recovery, so it can't overwrite the recovered run's messages, threads, or workflow state ([#23734](https://github.com/mastra-ai/mastra/issues/23734)).

Standalone servers don't support the multi-document transactions this needs, so they keep working as before without run fencing, and durable agents fall back to the PubSub lease.

Requires `@mastra/core` 1.75.0 or later.
