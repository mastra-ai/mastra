---
'@mastra/playground-ui': minor
---

Add the chat session transcript (reducer, message and tool rows, `TranscriptEntries`) under `@mastra/playground-ui/domains/chat/transcript`. Host-specific rows such as run errors, notifications, approvals and plan handoff plug in through `TranscriptSlotsProvider`; a host that leaves one out gets a plain read-only row, and tool approvals get a working default card.
