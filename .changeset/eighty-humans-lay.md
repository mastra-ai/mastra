---
'@mastra/core': patch
---

Fixed a multi-instance hang in evented execution mode. When two Mastra processes shared a UnixSocketPubSub broker, the agent's evented run could fail with `AGENT_GENERATE_MALFORMED_RESULT`, `condition is not a function`, or hang silently with ECANCELED errors during shutdown.

**What changed**

- Internal workflow events (execution-workflow, agentic-loop, nested children walked via `parentWorkflow`), per-run watch streams (`workflow.events.v2.*`), and scheduler-spawned background runs (`sched_wf_*`) are now delivered only inside the publishing process and no longer cross the unix socket.
- Live class instances on event payloads (e.g. the `MastraModelOutput` returned by an agent run) are preserved instead of being stripped by JSON serialization on the broker round-trip.

**Why**

Follow-up to the broker-side filter shipped in #17727. That filter ran after the publish frame had already been serialized, which stripped functions/streams from payloads and still fanned out cumulative `stepResults` blobs (often 9 MB+) to every connected client. Short-circuiting these publishes in-process removes the serialization round-trip entirely and lets the agent's run result survive intact.
