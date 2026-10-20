---
'@mastra/loggers': patch
---

Fixed scripts and command-line tools hanging after their work is done when they use `HttpTransport` or `UpstashTransport`. An idle transport no longer keeps the process alive, so it exits without calling `destroy()`. Buffered logs still keep the process running until they are sent.
