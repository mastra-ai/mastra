---
'@mastra/observability': patch
'@mastra/inngest': patch
'@mastra/core': patch
'@mastra/libsql': patch
---

Fixed an Inngest durable agent run outliving its `modelSettings.timeout.totalMs` deadline on the worker: the worker now stops at the deadline, ends the run's spans once as `limit / timeout`, and no longer re-writes the snapshot the caller deleted. Resumed Inngest workflow runs keep the suspended run's sampling decision and link to its span.
