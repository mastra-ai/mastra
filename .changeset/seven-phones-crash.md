---
'@mastra/observability': patch
'@mastra/inngest': patch
'@mastra/core': patch
---

Fixed an Inngest durable agent run outliving its `modelSettings.timeout.totalMs` deadline on the worker: the worker now stops at the deadline, ends the run's spans once as `limit / timeout`, and removes the run's snapshots as the caller does, so a timed-out run stays deleted. Resumed Inngest workflow runs keep the suspended run's sampling decision and link to its span.
