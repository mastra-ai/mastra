---
'@mastra/memory': patch
---

Fixed observational memory buffering to preserve more context and activate at the right time.

- **Fixed** activation timing so observations trigger mid-step as soon as the threshold is crossed, instead of waiting for the next user message.
- **Fixed** partial activations that left too much context — activation is now skipped when it can't compress enough, falling back to a full observation instead.
- **Fixed** token counting so reasoning-only message parts no longer inflate totals and cause premature context reduction.
- **Clarified** `blockAfter` behavior: values below 100 are treated as multipliers (e.g. `1.2` = 1.2× threshold), values ≥ 100 as absolute token counts.
