---
'@mastra/core': patch
---

Reduced storage used by agents that wait on tool approval or a suspended tool after recalling conversation history from memory. The saved run state now stores recalled messages as references to the stored messages instead of full copies. When the run resumes, the messages are loaded back from memory.

In a 12-step run that recalled 20 messages and then waited on tool approval, the saved run state was about 21% smaller.

This applies to agents configured with a memory instance. Agents whose memory is a function, or that use memory inherited from a supervisor agent, keep full copies of recalled messages, because a resumed run may not pass the request context that memory was chosen from. Durable agents keep full copies.

**Loading recalled messages back.** If a recalled message is edited while the run is suspended, the resumed run uses the stored version. If it is deleted, the resumed run drops it. Both are logged at debug level. The messages are loaded before the run continues, so if memory storage can't load them, the resume call (for example `approveToolCall`) throws before anything runs and the run stays suspended, so you can retry it.

**Storage reads.** Suspending looks up the recalled messages in memory storage by id, and resuming looks them up again. Cloudflare KV storage finds a message by id by checking every thread, so on KV each lookup reads every thread once per recalled message.

**Upgrading and downgrading.** Runs suspended on an earlier version still resume normally. Runs suspended on this version can't be resumed after downgrading to an earlier `@mastra/core` version.
