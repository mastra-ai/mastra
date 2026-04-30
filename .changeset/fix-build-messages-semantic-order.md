---
'@mastra/core': patch
---

Assistant message `parts` now preserve the correct order when reasoning, text, and tool chunks interleave. Previously, parts followed the order of end events, so a span whose end arrived first appeared earlier in the message even when its content actually started streaming later — for example a tool call could be emitted before reasoning that began first. Order now tracks when content actually started arriving. Closes #15914.
