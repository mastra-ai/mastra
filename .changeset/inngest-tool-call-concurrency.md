---
'@mastra/inngest': patch
---

Fixed durable agents on the Inngest engine ignoring `toolCallConcurrency` — parallel tool calls always ran one at a time. Tool calls now run concurrently up to the run's `toolCallConcurrency` (default 10). Concurrency is forced to 1 when the run requires tool approval or any tool in the step's effective active tool set requires approval or can suspend, so approval and suspend/resume flows keep working. The concurrency is resolved from the run's own state at execution time, so it stays correct across Inngest replays and concurrent runs. Fixes #19317.
