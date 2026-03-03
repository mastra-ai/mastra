---
'@mastra/memory': patch
---

Persist OM token-counter tiktoken estimates on message metadata so repeated token counting can reuse prior part/string payload estimates.

This keeps token accounting semantics unchanged: per-message and per-conversation overhead are still recomputed on each pass, and `data-*`/`reasoning` parts continue to be skipped.
