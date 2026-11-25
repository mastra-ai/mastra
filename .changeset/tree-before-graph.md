---
'mastra': patch
---

Factory's Knowledge page shows the page tree and the open page without waiting for the Knowledge graph. On a large or hosted Knowledge base the graph is the slow read: the page used to show a loader until it finished, and a failed graph read replaced the whole page with an error. Pins and mention links now fill in when the graph arrives, and a failed graph read shows a notice above the graph while the tree keeps working.
