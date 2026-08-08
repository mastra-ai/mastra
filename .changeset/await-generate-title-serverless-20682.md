---
'@mastra/core': patch
---

Fixed thread title generation being dropped on serverless runtimes that freeze after the response by awaiting title generation before finishing the run. (#20682)
