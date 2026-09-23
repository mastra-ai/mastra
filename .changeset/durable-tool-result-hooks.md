---
'@mastra/inngest': patch
'@mastra/core': patch
---

Output processors' `processToolResult` hooks now run on the durable engine. Previously they were skipped entirely, so a redaction processor had no effect on durable streams or transcripts. Processor mutations and tripwire blocks now apply to the emitted chunk and the persisted transcript, before the raw value can reach subscribers.
