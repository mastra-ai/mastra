---
'@mastra/factory': patch
---

Added an `actions` filter to the project audit log route, so the Factory UI fetches only the events it shows. Names outside the audit registry are dropped, and a request naming none of them gets a 400 `unknown_actions` instead of every event.
