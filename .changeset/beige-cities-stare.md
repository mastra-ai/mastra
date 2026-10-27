---
'@mastra/factory': patch
---

The Factory activity summary now loads only the events it shows, through a new `actions` filter on the project audit route. Unknown action names are ignored, and a request naming only unknown actions returns a 400 `unknown_actions` error instead of every event.
