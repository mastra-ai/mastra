---
'@mastra/core': patch
---

Fixed plain `agent.stream()` and `agent.generate()` hanging for a whole server cache outage (for example a paused or partitioned Redis) before a run starts. Runs now degrade instead of waiting on the cache:

- **Run IDs the server generates** no longer read the cache before starting. The run streams to its caller while the cache is unreachable, and its events reach the replay once the cache answers again.
- **Caller-supplied run IDs and resumes** still check who owns the run. That check now gives up after 5 seconds and refuses the run with an `AGENT_RUN_RECORD_UNAVAILABLE` error, so an ID another run owns is never taken over. A refused run opens no trace span and keeps the output processors a suspended run is holding, so a retry still resumes with them.
- **Replay is capped during an outage.** The live stream to the caller is never held back, but a run's queued replay events are capped at 10,000. Past the cap, the rest of the replay is dropped and `agent.observe()` ends with an `AGENT_STREAM_REPLAY_INCOMPLETE` error where it was cut short, instead of a finish event.

Also fixed two runs of the same caller-supplied ID in one process both being admitted when one was still in setup while the other started or finished.
