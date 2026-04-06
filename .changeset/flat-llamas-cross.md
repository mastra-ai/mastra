---
'@mastra/deployer': patch
'@mastra/deployer-cloud': patch
---

Fixed `mastra build` hanging sporadically during dependency installation when using bun. The child process stdin was left as an open pipe, causing bun to block when it attempted to read from stdin. Also fixed a potential crash (ERR_STREAM_WRITE_AFTER_END) when both stdout and stderr piped to a shared stream.
