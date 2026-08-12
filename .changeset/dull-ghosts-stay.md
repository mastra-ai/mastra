---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/factory': patch
---

Replaced the raw `buffering`/`observing`/`reflecting` phase label in the Factory status line with a cue on the memory budget it acts on. Background memory work now shimmers the token counter it is working through — the message window or `mem` — and stays wordless, while a memory pass that holds the turn is named ("saving memory", "consolidating memory"). Hovering a counter explains what memory is doing to it.
