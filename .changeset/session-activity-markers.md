---
'@mastra/factory': patch
---

Improved how a session says what it is doing. A sidebar row now carries an activity rail down its left edge instead of a dot in its trailing slot: marks travel down the rail while a run is underway, in the setup colour while the sandbox is still starting, and settle into a slow breath once the session is waiting on you. A board card shows the same thing on its own border — a lit head running the outline while work is in flight, the whole outline lit once the card is waiting on you.

Removed the marker for a session that is merely bound to a card: the card offers an Open session button instead, and the work item panel drops its dot for the same reason. Moving lifecycle off the row's trailing slot frees it — the actions menu no longer displaces the marker on hover, and a merged pull request keeps its badge.
