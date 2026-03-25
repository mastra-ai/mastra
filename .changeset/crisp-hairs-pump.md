---
'@mastra/core': patch
---

Fixed agent spans never being closed when an LLM error occurs or the request is aborted during streaming. Previously, traces would remain indefinitely "in progress" in observability backends like Braintrust. Spans are now properly ended with error information on all failure paths.
