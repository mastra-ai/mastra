---
'@mastra/playground-ui': minor
---

Make the Factory board and session transcript reusable outside Factory.

`@mastra/playground-ui` now ships the board components (cards, columns, list rows, filters, phase setup, board settings nav and map, boards and sessions sidebar nav) and the chat transcript (reducer, message and tool rows, `TranscriptEntries`). Host-specific rows such as run errors, notifications, approvals and plan handoff plug in through `TranscriptSlotsProvider`; a host that leaves one out gets a plain read-only row, and tool approvals get a working default card.
