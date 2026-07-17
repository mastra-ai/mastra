---
'@mastra/core': patch
---

Fixed unbounded memory growth during long goal runs. A goal run chains many agent turns inside one stream, and the stream previously kept every chunk, step, tool result, and text delta of the entire run in memory (and in suspend snapshots). Now each completed goal judge evaluation clears these run-lifetime buffers, preventing out-of-memory crashes on long goal runs.

**Behavior note:** for goal runs, run-end results (`text`, `steps`, `toolCalls`, `toolResults`, and `getFullOutput()`) now cover the segment after the last judge evaluation — for a completed goal that is the final answer. Token usage totals, streamed chunks, and persisted messages still span the whole run.
