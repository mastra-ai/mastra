---
'@mastra/factory': patch
---

Replaced the raw `buffering`/`observing`/`reflecting` phase label in the Factory status line with two rings, one per memory budget: the message window and the accumulated observations. Each ring shows how full its budget is, and a highlight travels around the ring while memory works through it — background work reads as work instead of leaking an internal phase name. A memory pass that actually holds the turn still says so ("saving memory", "consolidating memory"), and decode throughput moved from `42 tok/s` to a small curve that shows whether the run is speeding up or stalling. Hovering the status line unfolds the exact numbers behind every metric.
