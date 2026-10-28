---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed Inngest durable agents writing to memory after `modelSettings.timeout.totalMs` expired. A tool that finished after the deadline could still save its result (and the unfinished step) to memory, even with `savePerStep` off. The deadline now stops every later write on Inngest, as it already did on the other engines.

Inngest durable agents now also save the accepted user message when the total timeout hits, matching the other durable engines, so a timed-out conversation keeps the user's turn in history.
