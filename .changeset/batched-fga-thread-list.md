---
'@mastra/server': patch
---

Listing memory threads with fine-grained authorization now reads storage in batches of 100 and keeps only the requested page, instead of loading every matching thread at once. Totals and page contents are unchanged.
