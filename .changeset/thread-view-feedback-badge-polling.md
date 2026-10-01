---
'@mastra/playground-ui': patch
---

Reduce observability polling in Studio:

- Thread view: stop fetching and polling feedback for every trace row just to show a count on the Feedback tab. Feedback is now only loaded while a row's Feedback tab is open, matching the Messages and Scores tabs.
- Slow down the default refetch intervals: feedback polls every 30s (was 3s), scores and trace span scores every 15s (was 5s / 3s).
