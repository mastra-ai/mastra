---
'@mastra/core': patch
---

Reduced storage used by agent runs that recall conversation history from memory. Messages loaded from memory are now saved in workflow snapshots as references to the stored messages instead of full copies, and are loaded back from memory when the run continues. In a 12-step run that recalled 20 messages, persisted snapshot size dropped by about 25% for durable agents (on both the default and evented engines) and about 22% for agents waiting on tool approval.

This applies to agents configured with a memory instance. Agents whose memory is a function, or that use memory inherited from a supervisor agent, keep full copies of recalled messages, because a resumed run may not pass the request context that memory was chosen from. These agents still get the other snapshot size reductions in this release.

**Loading recalled messages back.** If a recalled message is edited or deleted in memory while a run is suspended, the resumed run uses the stored version and drops deleted messages, logging each change at debug level. If memory storage can't load the recalled messages when a run is resumed or recovered, the call fails before anything runs and the run stays as it was, so you can retry it.

A durable agent also loads them in the middle of a run when its process has no cached copy: when a step runs on a different worker (evented engine with a distributed pubsub), after more than 10 minutes between steps (for example, a slow tool call), or when more than 1,000 durable runs are in progress in one process. If memory storage fails at that point, the run fails.

**Storage reads.** Runs that save recalled messages as references look them up in memory storage by id, once when first saving them and again whenever they are loaded back as described above. Cloudflare KV storage finds a message by id by checking every thread, so on KV each lookup reads every thread once per recalled message.

**Upgrading and downgrading.** Runs started on an earlier version still resume and finish normally. Runs started on this version can't be resumed after downgrading to an earlier `@mastra/core` version.
