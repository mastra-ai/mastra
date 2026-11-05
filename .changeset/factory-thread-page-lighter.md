---
'@mastra/factory': patch
---

Thread pages load and settle faster: they no longer download the code editor bundle up front, and the conversation is no longer fetched again at the end of every turn when the live stream already delivered it.
