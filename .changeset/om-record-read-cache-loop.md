---
"@mastra/memory": patch
---

- Reduced redundant observational-memory row reads within a single loop step by reusing a turn-scoped OM record across step status checks and processor progress/tokens persistence.
- Updated step/turn plumbing to pass preloaded records into status reads and keep buffered-state updates aligned in-memory.
- Added a focused regression for cloned DB-row behavior, including buffering progress emission and pending token persistence when `processInputStep` runs.
