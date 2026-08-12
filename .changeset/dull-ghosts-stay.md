---
'@mastra/factory': patch
---

Replaced the raw `buffering`/`observing`/`reflecting` phase label in the Factory status line with two rings, one per memory budget: the message window and the accumulated observations. Each ring shows how full its budget is, and a highlight travels around the ring while memory works through it — background work reads as work instead of leaking an internal phase name. A memory pass that actually holds the turn still says so ("saving memory", "consolidating memory"), and decode throughput now shows a small waveform beside the rate, so a run that is stalling reads as one. Clicking a ring opens its budget in full: a progress bar, the exact figures, and a line saying what happens when that budget fills.

Fixed the throughput figure itself: it was dividing a whole step's tokens by the sliver of time between the step's last streamed chunk and its usage report, which could read as `354209 tok/s`. It is now measured on the streamed text over windows of at least 250ms, so it stays in the range a model can actually decode, and it clears when the run ends instead of leaving the last run's reading under an idle composer.
