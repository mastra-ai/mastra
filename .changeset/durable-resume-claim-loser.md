---
'@mastra/core': patch
---

Fixed durable agent resumes that lose a resume race or arrive after the run finished ([#27365](https://github.com/mastra-ai/mastra/issues/27365)).

- A second approval of the same tool call fails right away with `AGENT_RESUME_ALREADY_CLAIMED` while the first resume runs in the same process, including when both approvals arrive at the same moment. Before, it waited for the whole resumed turn or about 5 s and then failed with `DURABLE_AGENT_EXECUTION_CONFLICT`.
- A resume that loses the race reports the error only on its own stream. Clients following the run no longer get an error event or a span ended with an error while the winning resume completes.
- Resuming a run whose snapshot was already deleted (for example because another instance finished it) now fails with `AGENT_RESUME_NO_SNAPSHOT_FOUND` and no longer writes a new `pending` workflow row.
- A resume that loses the race no longer blocks the winning run's memory writes.
- The durable execution lease now follows `MASTRA_AGENT_THREAD_LEASE_TTL_MS` (renewed every third of it). The default TTL drops from 30 s to 15 s, so a run left by a crashed process becomes recoverable sooner.
