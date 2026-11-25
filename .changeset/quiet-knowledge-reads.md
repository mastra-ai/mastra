---
'mastra': patch
---

Factory's Knowledge page now reads each Knowledge query one at a time while an agent writes. Before, each burst of writes cancelled the refresh in progress and started a new one, but the server kept running the cancelled read, so an agent writing every 200 ms on a slow instance could leave 15 graph reads running at once. A write that lands during any read now gets one more read after it, so the page ends on the latest write. That includes a search still loading its first results, which used to keep results from before the write.
