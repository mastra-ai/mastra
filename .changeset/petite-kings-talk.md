---
'@mastra/core': patch
---

Fixed `Agent.stream()` rebuilding the observability logger and metrics contexts for every streamed chunk when tracing is enabled. The context is now resolved once per model step and reused, so tracing overhead no longer grows with the number of chunks in a response. Fixes #23198.
