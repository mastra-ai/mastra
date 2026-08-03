---
'@mastra/core': patch
---

Fixed agent thread subscriptions so every instance in a multi-instance deployment sees the same conversation:

- Subscribers on any instance now replay completed runs identically instead of diverging from the instance that ran them.
- Reconnecting to a thread no longer wedges `agent.stream()` behind a stale run left by a crashed or finished process.
- Aborting a thread now works from any instance — the request is routed to the process that owns the run.
- A `stream()`/`generate()` call started while another instance is mid-run on the same thread now waits its turn instead of interleaving output.
