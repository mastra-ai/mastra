---
'@mastra/playground-ui': patch
---

Thread view: stop fetching and polling feedback for every trace row just to show a count on the Feedback tab. Feedback is now only loaded while a row's Feedback tab is open, matching the Messages and Scores tabs.
