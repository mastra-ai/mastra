---
'@mastra/core': patch
---

Knowledge page paths ignore leading, trailing and doubled slashes, so `docs:acme#models/gateways/` names the same page as `docs:acme#models/gateways`. This holds for `upsertPage`, `removePage`, the note methods, `[[links]]` in notes, page refs given to the Knowledge tools, and `pinnedContext` refs. Previously `upsertPage` refused such paths and reads reported the page as not found.
