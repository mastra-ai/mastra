---
'@mastra/inngest': patch
---

Fixed `POST /agents/:agentId/threads/abort` for Inngest agents. The route now sends the abort request to the Inngest worker running the thread, including for runs started from another server. Before, a server that didn't start the run sent nothing.

For a run this server didn't start, the route finds it through the thread lease, so this needs a pubsub with a shared lease backend such as Redis or Valkey. The synchronous `abortThreadStream` on an Inngest agent still only stops runs this server knows about.
