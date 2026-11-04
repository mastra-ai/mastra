---
'@mastra/core': patch
---

Fixed a failed workspace filesystem resolver call being cached for the rest of the request. A transient error no longer disables filesystem and skill tools until the next request; the next call retries the resolver.
