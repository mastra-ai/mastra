---
'@mastra/inngest': patch
---

Fixed `POST /agents/:agentId/threads/abort` for Inngest agents. The route now stops the run on the Inngest worker, including runs started from another server. Before, it could return `{ aborted: true }` while the run kept going.

For a run this server didn't start, the route finds it through the thread lease, so this needs a pubsub with a shared lease backend such as Redis or Valkey. The synchronous `abortThreadStream` on an Inngest agent still only stops runs this server knows about.
