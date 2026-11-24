---
'@mastra/memory': patch
---

Improved Observational Memory history loading by inserting stored messages in batches, preserving message ordering, deduplication, and incoming client tool results. Recorded MessageList `add` events now group each loaded or reinserted batch into one event with `count: N`, instead of N events with `count: 1`.
