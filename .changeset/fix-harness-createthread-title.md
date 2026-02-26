---
'@mastra/core': patch
---

Fixed `Harness.createThread()` defaulting the thread title to `"New Thread"` which prevented `generateTitle` from working (see #13391). Threads created without an explicit title now have an empty string title, allowing the agent's title generation to produce a title from the first user message.
