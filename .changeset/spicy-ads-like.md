---
'@mastra/code-sdk': patch
---

Fixed a leak where Mastra Code instances with cross-agent communication kept one open socket, and often a socket file under `/tmp/mc`, for every agent discovery request. Long-running instances could accumulate thousands of open sockets. One-off discovery replies now close as soon as they're answered, so socket and file counts stay flat.
