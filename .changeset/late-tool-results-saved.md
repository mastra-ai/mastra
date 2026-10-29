---
'@mastra/core': patch
'@mastra/inngest': patch
---

Memory writes are no longer blocked after `modelSettings.timeout.totalMs` expires. A tool or step that finishes after the deadline now saves its result to memory, so the agent keeps a record of everything it did. The run still stops with one `MastraTimeoutError` at the deadline, and the user's message is still saved before the run starts.
