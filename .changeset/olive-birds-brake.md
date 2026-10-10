---
'@mastra/core': patch
---

Reduced storage used by agent runs that recall conversation history from memory. Saved run state now stores recalled messages as references to the stored messages instead of full copies. When the run continues, the messages are loaded back from memory.

In a 12-step run that recalled 20 messages, the saved run state was about 25% smaller for durable agents and about 21% smaller for agents waiting on tool approval.

This applies to agents configured with a memory instance. Agents whose memory is a function, or that use memory inherited from a supervisor agent, keep full copies of recalled messages, because a resumed run may not pass the request context that memory was chosen from.

**Loading recalled messages back.** If a recalled message is edited while a run is suspended, the resumed run uses the stored version. If it is deleted, the resumed run drops it. Both are logged at debug level. When a run is resumed or recovered, the messages are loaded before anything runs, so if memory storage can't load them, the call (for example `approveToolCall` or `recover`) throws and the run stays as it was, so you can retry it.

A durable agent also loads them in the middle of a run when its process has no cached copy: when a step runs on a different worker (evented engine with a distributed pubsub), after more than 10 minutes between steps (for example, a slow tool call), or when more than 1,000 durable runs are in progress in one process. A memory storage failure at that point is retried for about 10 seconds, with each retry logged as a warning. If memory storage is still failing after that, the run fails.

**Storage reads.** Runs that store recalled messages as references look them up in memory storage by id, once when first storing them and again whenever they are loaded back as described above. Cloudflare KV storage finds a message by id by checking every thread, so on KV each lookup reads every thread once per recalled message.

**Upgrading and downgrading.** Runs started on an earlier version still resume and finish normally. Runs started on this version can't be resumed after downgrading to an earlier `@mastra/core` version.
