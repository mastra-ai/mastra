---
'@mastra/factory': patch
---

Board cards now carry one status line instead of stacking several. A card announces the move or run you just triggered, then what automation is doing on its own, then what a click will do — and rule effects speak plain language: "Starting an automated run…" instead of queue jargon, with a failure reading "Automated run could not start" and the raw error one hover away, next to Retry. An effect the server is already retrying says so, so a card that keeps re-attempting no longer looks like one starting for the first time.

Unfiled GitHub and Linear items now use the same card as filed work: the whole card starts the default run, a link to the issue or pull request sits beside the title, every other action lives in the kebab menu, and the card reports "Starting run…" while the click resolves instead of looking inert.

A card at rest also shows less: the click hint and the actions menu fade in when you point at the card or reach it with the keyboard, the hint shares the author's line rather than costing a row of its own, and labels take less height. Touch devices, which have no hover to reveal anything with, keep both visible.
