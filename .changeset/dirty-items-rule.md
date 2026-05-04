---
'@mastra/koa': minor
---

Improved the Koa adapter to make request routing more efficient as route counts grow.

Requests now move through a leaner routing path with lower middleware overhead, which helps Koa-based Mastra servers stay faster and produce cleaner request traces without changing the public API.
