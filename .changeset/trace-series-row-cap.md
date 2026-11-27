---
'@mastra/playground-ui': patch
---

Fixed dashboard charts on Traces and Spans failing to load over windows longer than about four days. A bucketed trace or span query with no limit of its own now asks for as many groups as fit the server's 10 000-row cap (an hourly week keeps 59 groups instead of failing), and still uses the server's default of 100 where that fits. Queries that set their own limit are sent unchanged.
