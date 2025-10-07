---
'@mastra/deployer': patch
---

Correctly handle errors in streams. Errors (e.g. rate limiting) before the stream begins are now returned with their code. Mid-stream errors are passed as a chunk (with `type: 'error'`) to the stream.
