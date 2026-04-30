---
'@mastra/memory': patch
---

Fixed idle timeout and provider-change observation activations blocking on in-progress reflection buffering. These triggers now return immediately, letting the background reflection complete asynchronously.
