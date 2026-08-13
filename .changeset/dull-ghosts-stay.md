---
'@mastra/factory': patch
---

Replaced the raw `buffering`/`observing`/`reflecting` phase label in the Factory status line with two rings, one per memory budget: the message window and the accumulated observations. Each ring shows how full its budget is, and a highlight travels around the ring while memory works through it — background work reads as work instead of leaking an internal phase name. A memory pass that actually holds the turn still says so ("saving memory", "consolidating memory"). Both rings sit in one control, and clicking it opens both budgets in full: an icon each in the budget's own colour, the figures, and a line saying what reaching the threshold sets off. The control speaks both readings to assistive tech, which a button otherwise hides.

A background pass now shows on the budget it actually acts on, rather than as one word shared by both.
