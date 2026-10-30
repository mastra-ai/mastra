---
'@mastra/core': patch
'@mastra/inngest': patch
---

Inngest durable agents no longer block memory writes after `modelSettings.timeout.totalMs` expires. When a tool is still running at the deadline, its step is now saved to memory with the tool call. A tool that outlives the abort grace period is recorded as aborted rather than with its late return value. The run still stops with one `MastraTimeoutError` at the deadline in the process that started it; steps already running on a separate Inngest worker are not signalled. The user's message is still saved before the run starts. Durable and evented agents are unchanged: they release their execution claim at the deadline, so a late step, or a user message whose save is still in flight, is not saved.
