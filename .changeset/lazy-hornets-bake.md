---
'@mastra/factory': patch
---

Boards now update within a second of a change instead of every few seconds, and at most every 3 seconds while a lot is changing at once. Moving or editing a card, a decision being proposed, picked up, retried or finished, and a session starting, parking, finishing or being torn down mid-run now reach every open board right away. While a board is connected it no longer asks for its cards, decisions and running sessions every 2 to 5 seconds; it checks once a minute as a safety net, and goes back to the old pace if the live connection drops. On boards whose first column isn't Intake, that column now shows its loading placeholder while new items load.
