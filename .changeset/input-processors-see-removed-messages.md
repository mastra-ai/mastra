---
'@mastra/core': patch
---

**Fixed** removed messages coming back into the request when several input processors run in one step.

When an input processor removed messages in `processInputStep`, as observational memory does when it compacts a long run, the processors after it were still handed the old `messages` array. A processor that returned that array put the removed messages back, so the prompt kept growing even while memory compacted it. Each processor is now handed the messages as they are after the processors before it ran.
