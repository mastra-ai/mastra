---
'@mastra/loggers': patch
---

`HttpTransport` and `UpstashTransport` no longer keep Node.js processes running when they have nothing to send. Short-lived scripts now exit by themselves once their work is done, without calling `destroy()` or `process.exit()`. Logs that are still waiting to be sent still keep the process alive until the next flush delivers them.
