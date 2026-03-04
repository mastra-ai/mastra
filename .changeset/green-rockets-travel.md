---
'@mastra/memory': patch
---

Persist message token estimates in metadata so repeated counting can reuse previously computed values after messages are saved and loaded.

Token totals stay consistent with prior behavior: message and conversation overhead is still recalculated each pass, and `data-*`/`reasoning` parts are still excluded from estimate caching.
