---
'@mastra/core': patch
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
---

Fixed activation safeguards in buffered observation chunk selection. Under-boundary and force-max-activation paths now enforce a minimum remaining token floor, preventing context from collapsing when chunks are swapped.
