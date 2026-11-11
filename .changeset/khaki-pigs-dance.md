---
'@mastra/core': patch
---

Fixed live scorers storing data that the scored agent hides from traces. When an agent run uses `tracingOptions.hideInput` or `tracingOptions.hideOutput`, its scorers now follow the same setting:

- Stored scores replace both input and output with `[REDACTED]` when either side is hidden. Scorer preparation can mix the two sides, so judge prompts, step results, and the reason are redacted too. The score value is kept.
- The scorer's own trace, including judge model calls, hides both input and output when either flag is set, because judge prompts and results mix the two.
- Score events sent to observability exporters leave out the reason.
