---
'@mastra/server': patch
---

Catch rejected background Run.resume() and Run.timeTravel() in the workflow /resume and /time-travel routes so they cannot become unhandled rejections and terminate the server process
