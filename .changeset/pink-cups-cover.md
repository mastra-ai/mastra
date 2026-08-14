---
'@mastra/factory': patch
---

Board cards now show one status line instead of stacking several. A card reports what you just triggered, then what a rule is doing on its own, then what a click will do — one thing at a time, in that order.

Automatic actions say what they do rather than where they sit in a queue. A card reads "Starting an automated run…" while a rule works, and "Automated run could not start" when it gives up, with the raw error one hover away next to Retry. An action the server is still re-attempting says "— retrying…", so a card looping through retries no longer looks like one starting for the first time.

Unfiled GitHub and Linear items now use the same card as filed work. Clicking anywhere on the card starts its default run and reports "Starting run…" while that resolves, instead of looking inert. A link to the issue or pull request sits beside the title, and the remaining actions are in the card's actions menu.

A resting card also shows less. The click hint and the actions menu fade in when you point at the card or reach it with the keyboard, the hint shares the author's line instead of taking a row of its own, and labels are shorter. Touch screens have no hover, so they keep both visible.
