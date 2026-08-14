---
'@mastra/factory': patch
---

Board cards now carry one status line instead of stacking several. A card announces the move or run you just triggered, then what automation is doing on its own, then what a click will do — and rule effects speak plain language: "Starting an automated run…" instead of queue jargon, with a failure reading "Automated run could not start" and the raw error one hover away, next to Retry.

Unfiled GitHub and Linear items now use the same card as filed work: the whole card starts the default run, every other action lives in the kebab menu, and the card reports "Starting run…" while the click resolves instead of looking inert.
