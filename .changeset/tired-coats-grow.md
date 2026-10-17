---
'@mastra/server': patch
'@mastra/core': patch
---

Fixed observe requests for a run that already finished or never existed hanging until the idle timeout. The stream now closes as soon as the run is known to have settled, instead of staying open with no events.
