---
'@mastra/core': patch
---

Fixed durable agent parity gaps: emit `start` chunk for correct stream ordering, handle TripWire from input processors during preparation, and port `onInputAvailable`/`onOutput` tool lifecycle hooks to the durable tool execution path. Removed stale test harness guards that were preventing `isTaskComplete`, `actor`, `savePerStep`, and `providerOptions` from reaching durable agent runs. These fixes enable 20+ scenario tests to run on the durable engine.
