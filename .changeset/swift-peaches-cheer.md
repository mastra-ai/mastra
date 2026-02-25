---
'@mastra/memory': patch
---

Fixed several observational memory buffering bugs:

**Mid-step activation deferral**: Activation now triggers mid-step when the threshold is crossed, instead of deferring to the next user turn.

**Incomplete activation guard**: Activation is skipped if the projected remaining tokens would still be far above the retention floor. This allows fallback to sync observation instead of accepting a partial activation that leaves too much context.

**Reasoning parts excluded from token counting**: Reasoning parts are no longer counted toward message token totals, matching how data-\* parts are handled. This prevents inflated token counts from causing over-aggressive context reduction.

**blockAfter parsing**: Values under 100 are now treated as multipliers (e.g. 1.2 = 1.2x threshold), values >= 100 as absolute token counts.
