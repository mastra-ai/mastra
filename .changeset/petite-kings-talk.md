---
'@mastra/core': patch
---

Fixed `Agent.stream()` rebuilding the observability logger and metrics contexts for every streamed chunk when tracing is enabled. The context is now resolved once per model step and reused, so tracing overhead no longer grows with the number of chunks in a response. In a stream of 1,000 chunks this removes about 8,000 unnecessary metadata copies per call. Fixes #23198.
