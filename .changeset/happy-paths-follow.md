---
'mastracode': minor
---

Added a live tokens/sec counter to the MastraCode terminal and web status lines.

The counter shows how fast the model is generating, measured over decode time only — the window from the first streamed token of a step to when that step finishes. This excludes time-to-first-token, tool execution, and scheduling gaps, so the number reflects real generation speed instead of reading artificially low. Reasoning tokens are included, and the rate is smoothed with an exponential moving average for a stable readout.

The last reading stays visible while idle so you can read it after a turn finishes, and it clears when the next turn begins.
