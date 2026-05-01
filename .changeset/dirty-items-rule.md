---
'@mastra/koa': minor
---

Improved the Koa adapter so requests go through a single route dispatcher, reducing noisy middleware tracing in APM without changing the public API.
