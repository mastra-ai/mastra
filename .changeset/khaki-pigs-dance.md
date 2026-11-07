---
'@mastra/core': patch
---

Fixed live scorers storing data that the scored agent hides from traces. When an agent run uses `tracingOptions.hideInput` or `tracingOptions.hideOutput`, its scorers now follow the same setting:

- Stored scores replace the hidden input or output with `[REDACTED]`. Judge prompts, step results, and the reason are redacted too, because they quote the scored data. The score value is kept.
- The scorer's own trace, including judge model calls, hides both input and output when either flag is set, because judge prompts and results mix the two.
- Score events sent to observability exporters leave out the reason.
