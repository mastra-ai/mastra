---
'@mastra/loggers': patch
---

Fixed HTTP and Upstash log transports replacing a supplied `time: 0` with the current time. Epoch-zero timestamps are now preserved; logs without a `time` still get the current time.
